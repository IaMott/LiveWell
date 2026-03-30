import { getAuthUserId } from '@/lib/auth'
import { stripAssistantStoredMetadata } from '@/lib/chat/thinkingPersistence'
import { sanitizeAssistantVisibleContent } from '@/lib/chat/userVisibleContent'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({
    key: `conversations-list:${userId}:${getClientIp(request)}`,
    max: 60,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        caseStatus: true,
        casePriority: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          select: { role: true, content: true, domain: true, specialistName: true },
        },
        summary: {
          select: { summary: true },
        },
      },
    })

    return Response.json({
      conversations: conversations.map((c) => {
        const lastMsg = c.messages[0]
        const assistantMsg = c.messages.find((m) => m.role === 'assistant')
        const previewContent =
          lastMsg?.role === 'assistant'
            ? sanitizeAssistantVisibleContent(stripAssistantStoredMetadata(lastMsg.content))
            : (lastMsg?.content ?? '')
        return {
          id: c.id,
          title: c.title ?? 'Conversazione',
          updatedAt: c.updatedAt.toISOString(),
          preview: previewContent.slice(0, 80),
          specialist: assistantMsg?.specialistName ?? null,
          summary: c.summary?.summary ?? null,
          caseStatus: c.caseStatus,
          casePriority: c.casePriority,
        }
      }),
    })
  } catch {
    // Fallback: return basic list without specialist info (e.g. during schema migration)
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { role: true, content: true },
          },
        },
      })
      return Response.json({
        conversations: conversations.map((c) => ({
          id: c.id,
          title: c.title ?? 'Conversazione',
          updatedAt: c.updatedAt.toISOString(),
          preview: (c.messages[0]?.role === 'assistant'
            ? sanitizeAssistantVisibleContent(stripAssistantStoredMetadata(c.messages[0].content))
            : (c.messages[0]?.content ?? '')
          ).slice(0, 80),
          specialist: null,
        })),
      })
    } catch {
      return Response.json({ conversations: [] })
    }
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({
    key: `conversations-delete:${userId}:${getClientIp(request)}`,
    max: 30,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Troppe richieste — riprova tra poco')

  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  if (!id?.trim()) return errorResponse(400, 'BAD_REQUEST', 'Missing conversation id')

  const conv = await prisma.conversation.findUnique({ where: { id }, select: { userId: true } })
  if (!conv || conv.userId !== userId)
    return errorResponse(404, 'NOT_FOUND', 'Conversation not found')

  // C2: Soft-delete — set deletedAt instead of hard delete to preserve data recovery.
  // The GET query already filters `deletedAt: null`.
  await prisma.conversation.update({ where: { id }, data: { deletedAt: new Date() } })
  return Response.json({ ok: true })
}
