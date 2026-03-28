import { z } from 'zod'
import { getAuthUserId } from '@/lib/auth'
import { readCanonicalCaseRuntimeState } from '@/lib/ai/case/persistence'
import { decodeAssistantStoredContent } from '@/lib/chat/thinkingPersistence'
import { sanitizeAssistantVisibleContent } from '@/lib/chat/userVisibleContent'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

const VALID_CASE_STATUSES = ['active', 'open', 'pending', 'completed', 'archived'] as const
const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low', 'backlog'] as const

const patchSchema = z.object({
  caseStatus: z.enum(VALID_CASE_STATUSES).optional(),
  casePriority: z.enum(VALID_PRIORITIES).optional(),
  title: z.string().min(1).max(200).optional(),
})

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
          replyToMessageId: true,
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
  const stateSnapshot = readCanonicalCaseRuntimeState(caseStateRow)

  return Response.json({
    id: conv.id,
    title: conv.title ?? 'Conversazione',
    stateSnapshot: stateSnapshot ?? undefined,
    messages: conv.messages.flatMap((m) => {
      if (m.role !== 'assistant') {
        return [
          {
            content: m.content,
            id: m.id,
            role: m.role,
            domain: m.domain ?? undefined,
            specialistName: m.specialistName ?? undefined,
            replyToMessageId: m.replyToMessageId ?? undefined,
            createdAt: m.createdAt.toISOString(),
          },
        ]
      }

      const decoded = decodeAssistantStoredContent(m.content)
      const sanitizedContent = sanitizeAssistantVisibleContent(decoded.content)
      if (!sanitizedContent && !(decoded.thinkingSteps && decoded.thinkingSteps.length > 0)) {
        return []
      }

      return [
        {
          content: sanitizedContent,
          thinkingSteps: decoded.thinkingSteps,
          id: m.id,
          role: m.role,
          domain: m.domain ?? undefined,
          specialistName: m.specialistName ?? undefined,
          replyToMessageId: m.replyToMessageId ?? undefined,
          createdAt: m.createdAt.toISOString(),
        },
      ]
    }),
  })
}

/**
 * PATCH /api/conversations/[id]
 * Update caseStatus, casePriority, or title on a conversation.
 * This is the write path that makes the multi-case/backlog/priority model actually functional.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({
    key: `conversation-patch:${userId}:${getClientIp(request)}`,
    max: 30,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const { id } = await params

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await request.json())
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
  }

  if (!body.caseStatus && !body.casePriority && !body.title) {
    return errorResponse(400, 'BAD_REQUEST', 'At least one field required')
  }

  // Verify ownership
  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!conv || conv.userId !== userId)
    return errorResponse(404, 'NOT_FOUND', 'Conversation not found')

  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      ...(body.caseStatus ? { caseStatus: body.caseStatus } : {}),
      ...(body.casePriority ? { casePriority: body.casePriority } : {}),
      ...(body.title ? { title: body.title } : {}),
    },
    select: {
      id: true,
      title: true,
      caseStatus: true,
      casePriority: true,
      updatedAt: true,
    },
  })

  return Response.json({ conversation: updated })
}
