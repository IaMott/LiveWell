import { z } from 'zod'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  /**
   * ID of the existing conversation to append to.
   * If null/omitted, a new conversation titled "Sessione Vocale" is created
   * automatically — allows Live sessions to be transcribed even when the user
   * hasn't sent any text messages yet.
   */
  conversationId: z.string().min(1).optional().nullable(),
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
 * triggering the AI orchestrator. Creates a new conversation automatically
 * when conversationId is not provided.
 * Returns { ok: true, conversationId } so the client can use the same ID
 * for subsequent saves within the same Live session.
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

  let conversationId = body.conversationId ?? null

  if (conversationId) {
    // Ownership check: existing conversation must belong to the authenticated user
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    })
    if (!existing) return errorResponse(404, 'BAD_REQUEST', 'Conversation not found')
  } else {
    // No conversation yet — create one automatically for this Live session
    const created = await prisma.conversation.create({
      data: { userId, title: 'Sessione Vocale' },
      select: { id: true },
    })
    conversationId = created.id
  }

  await prisma.message.createMany({
    data: body.messages.map((m) => ({
      conversationId: conversationId as string,
      role: m.role,
      content: m.content,
    })),
  })

  return new Response(JSON.stringify({ ok: true, conversationId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
