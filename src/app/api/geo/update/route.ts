import { z } from 'zod'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { setGeoPreference, upsertCoarseLocation, clearCoarseLocation } from '@/lib/db'

const requestSchema = z.object({
  enabled: z.boolean(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
  // lat/lon accepted from browser but stored rounded (≈1km) — never returned to callers
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  accuracy: z.string().max(50).optional(),
})

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
  }

  const rate = checkRateLimit({
    key: `geo-update:${userId}:${getClientIp(request)}`,
    max: 20,
  })
  if (!rate.ok) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    )
  }

  let body: z.infer<typeof requestSchema>
  try {
    const raw = (await request.json()) as unknown
    const parsed = requestSchema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
    body = parsed.data
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body')
  }

  await setGeoPreference(userId, body.enabled)

  if (body.enabled) {
    await upsertCoarseLocation(userId, {
      country: body.country,
      region: body.region,
      city: body.city,
      timezone: body.timezone,
      lat: body.lat,
      lon: body.lon,
      accuracy: body.accuracy,
    })
  } else {
    await clearCoarseLocation(userId)
  }

  return NextResponse.json({ ok: true, enabled: body.enabled })
}
