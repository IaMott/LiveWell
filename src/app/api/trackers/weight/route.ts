import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `tracker-weight:${userId}:${getClientIp(request)}`, max: 20 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: { value?: number; unit?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  const value = Number(body.value)
  if (!body.value || isNaN(value) || value < 20 || value > 500) {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid weight value')
  }

  const unit = ['kg', 'lbs'].includes(String(body.unit)) ? String(body.unit) : 'kg'

  const entry = await prisma.bodyMetricEntry.create({
    data: {
      userId,
      metricType: 'weight',
      value,
      unit,
    },
    select: { id: true },
  })

  return Response.json({ ok: true, id: entry.id })
}
