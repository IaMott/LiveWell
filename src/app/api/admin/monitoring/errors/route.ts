import { getAuthRole, getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { getApiErrorDashboard } from '@/lib/monitoring/apiErrorEvents'

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const role = await getAuthRole(request)
  if (role !== 'OWNER') return errorResponse(403, 'UNAUTHORIZED', 'Owner role required')

  const rate = checkRateLimit({
    key: `monitoring-errors:${userId}:${getClientIp(request)}`,
    max: 60,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const url = new URL(request.url)
  const hours = Number(url.searchParams.get('hours') ?? '24')
  const take = Number(url.searchParams.get('take') ?? '50')

  const snapshot = await getApiErrorDashboard({
    hours: Number.isFinite(hours) ? Math.max(1, Math.min(168, hours)) : 24,
    take: Number.isFinite(take) ? Math.max(1, Math.min(200, take)) : 50,
  })

  return Response.json(snapshot)
}
