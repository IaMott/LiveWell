import { z } from 'zod'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

function buildSnippet(content: string, query: string): string {
  const lower = content.toLowerCase()
  const queryLower = query.toLowerCase()
  const idx = lower.indexOf(queryLower)
  if (idx === -1) return content.slice(0, 150) + (content.length > 150 ? '...' : '')
  const start = Math.max(0, idx - 60)
  const end = Math.min(content.length, idx + query.length + 60)
  const snippet = content.slice(start, end)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < content.length ? '...' : ''
  return `${prefix}${snippet}${suffix}`
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid query params')

  const { q, limit } = parsed.data

  const messages = await prisma.message.findMany({
    where: {
      conversation: { userId },
      content: { contains: q, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 3, // fetch more to handle dedup
    select: {
      id: true,
      content: true,
      role: true,
      createdAt: true,
      conversationId: true,
      conversation: {
        select: { id: true, title: true, createdAt: true },
      },
    },
  })

  // Dedup by conversation — keep only the first (most recent) matching message per conversation
  const seenConversationIds = new Set<string>()
  const results = messages
    .filter((m) => {
      if (seenConversationIds.has(m.conversationId)) return false
      seenConversationIds.add(m.conversationId)
      return true
    })
    .slice(0, limit)
    .map((m) => ({
      conversationId: m.conversationId,
      conversationTitle: m.conversation.title,
      conversationCreatedAt: m.conversation.createdAt,
      matchingMessage: {
        id: m.id,
        role: m.role,
        snippet: buildSnippet(m.content, q),
        createdAt: m.createdAt,
      },
    }))

  return Response.json({ results, query: q, total: results.length })
}
