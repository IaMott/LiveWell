import { getAuthUserId } from '@/lib/auth'
import { toCanonicalCaseStateSnapshot } from '@/lib/ai/case/compat'
import { fromStoredCaseState } from '@/lib/ai/case/persistence'
import { decodeAssistantStoredContent } from '@/lib/chat/thinkingPersistence'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({
    key: `conversation-get:${userId}:${getClientIp(request)}`,
    max: 60,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const { id } = await params

  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      userId: true,
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          domain: true,
          specialistName: true,
          createdAt: true,
        },
      },
    },
  })

  if (!conv || conv.userId !== userId)
    return errorResponse(404, 'NOT_FOUND', 'Conversation not found')

  const caseStateRow = await prisma.caseState.findUnique({
    where: { conversationId: conv.id },
  })
  const stateSnapshot = toCanonicalCaseStateSnapshot(fromStoredCaseState(caseStateRow))

  return Response.json({
    id: conv.id,
    title: conv.title ?? 'Conversazione',
    stateSnapshot: stateSnapshot ?? undefined,
    messages: conv.messages.map((m) => ({
      ...(m.role === 'assistant'
        ? decodeAssistantStoredContent(m.content)
        : { content: m.content }),
      id: m.id,
      role: m.role,
      domain: m.domain ?? undefined,
      specialistName: m.specialistName ?? undefined,
      createdAt: m.createdAt.toISOString(),
    })),
  })
}
