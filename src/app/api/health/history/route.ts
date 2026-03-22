/**
 * GET /api/health/history?domain=health&key=weight&limit=50
 *
 * Storico nel tempo di un singolo attributo (UserAttribute time-series).
 * Utile per graficare la progressione: peso, pressione, glicemia, ecc.
 */

import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `health-history:${userId}:${getClientIp(request)}`, max: 60 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')
  const key = searchParams.get('key')
  const limitParam = searchParams.get('limit')
  const limit = Math.min(parseInt(limitParam ?? '100', 10) || 100, 500)

  if (!key) return errorResponse(400, 'BAD_REQUEST', 'Missing required param: key')

  const entries = await prisma.userAttribute.findMany({
    where: {
      userId,
      key,
      ...(domain ? { domain } : {}),
    },
    orderBy: { recordedAt: 'asc' },
    take: limit,
    select: {
      id: true,
      domain: true,
      key: true,
      value: true,
      unit: true,
      notes: true,
      source: true,
      recordedAt: true,
    },
  })

  return Response.json({
    domain: domain ?? 'all',
    key,
    count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      value: e.value,
      unit: e.unit,
      notes: e.notes,
      source: e.source,
      recordedAt: e.recordedAt.toISOString(),
    })),
  })
}
