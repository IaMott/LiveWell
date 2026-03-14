import { z } from 'zod'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['success', 'failure']).optional(),
  toolName: z.string().max(64).optional(),
})

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    toolName: url.searchParams.get('toolName') ?? undefined,
  })
  if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid query params')

  const { limit, offset, status, toolName } = parsed.data
  const whereClause = {
    userId,
    ...(status ? { status } : {}),
    ...(toolName ? { toolName } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.toolAuditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        toolName: true,
        status: true,
        errorCode: true,
        inputSummary: true,
        requestId: true,
        conversationId: true,
        createdAt: true,
      },
    }),
    prisma.toolAuditLog.count({ where: whereClause }),
  ])

  return Response.json({ logs, total, limit, offset })
}
