import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `tracker-mood:${userId}:${getClientIp(request)}`, max: 30 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: { mood?: number; stress?: number; content?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  const mood = body.mood != null ? Math.max(1, Math.min(10, Number(body.mood))) : null
  const stress = body.stress != null ? Math.max(1, Math.min(10, Number(body.stress))) : null
  const content = body.content ? String(body.content).slice(0, 1000) : null

  if (mood === null && stress === null && content === null) {
    return errorResponse(400, 'BAD_REQUEST', 'At least one of mood, stress, content is required')
  }

  const entry = await prisma.mindfulnessEntry.create({
    data: { userId, mood, stress, content },
    select: { id: true },
  })

  return Response.json({ ok: true, id: entry.id })
}
