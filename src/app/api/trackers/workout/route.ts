import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `tracker-workout:${userId}:${getClientIp(request)}`, max: 30 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: { durationMin?: number; perceivedEffort?: number; notes?: string; date?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  const durationMin = Math.max(1, Math.min(600, Number(body.durationMin ?? 30)))
  const perceivedEffort =
    body.perceivedEffort != null
      ? Math.max(1, Math.min(10, Number(body.perceivedEffort)))
      : null
  const notes = body.notes ? String(body.notes).slice(0, 500) : null
  const date = body.date ? new Date(body.date) : new Date()

  const session = await prisma.workoutSession.create({
    data: {
      userId,
      durationMin,
      perceivedEffort,
      notes,
      date,
    },
    select: { id: true },
  })

  return Response.json({ ok: true, id: session.id })
}
