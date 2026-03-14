import { z } from 'zod'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

const querySchema = z.object({
  type: z.enum(['nutrition', 'training', 'mindfulness', 'other']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    type: url.searchParams.get('type') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid query params')

  const { type, limit, offset } = parsed.data
  const whereClause = { userId, ...(type ? { type } : {}) }

  const [artifacts, total] = await Promise.all([
    prisma.recommendationArtifact.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        contentMarkdown: true,
        createdAt: true,
        relatedConversationId: true,
      },
    }),
    prisma.recommendationArtifact.count({ where: whereClause }),
  ])

  return Response.json({ artifacts, total, limit, offset })
}
