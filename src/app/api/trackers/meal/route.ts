import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `tracker-meal:${userId}:${getClientIp(request)}`, max: 60 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: { mealType?: string; notes?: string; date?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  const mealType = String(body.mealType ?? 'pasto').slice(0, 50)
  const notes = body.notes ? String(body.notes).slice(0, 500) : null
  const date = body.date ? new Date(body.date) : new Date()

  const meal = await prisma.meal.create({
    data: {
      createdByUserId: userId,
      mealType,
      date,
      items: [],
      notes,
    },
    select: { id: true, mealType: true, date: true },
  })

  return Response.json({ ok: true, id: meal.id })
}
