import { z } from 'zod'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  conversationId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(50),
})

/**
 * POST /api/chat/transcript
 * Saves Live session transcript messages directly to a conversation without
 * triggering the AI orchestrator. Used by LiveModal to persist the voice
 * dialogue as chat history.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
  }

  // Ownership check: conversation must belong to the authenticated user
  const conversation = await prisma.conversation.findFirst({
    where: { id: body.conversationId, userId },
    select: { id: true },
  })
  if (!conversation) return errorResponse(404, 'NOT_FOUND', 'Conversation not found')

  await prisma.message.createMany({
    data: body.messages.map((m) => ({
      conversationId: body.conversationId,
      role: m.role,
      content: m.content,
    })),
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
