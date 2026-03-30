import { z } from 'zod'
import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

/** Shape of preferences stored in UserProfile.settings */
export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system'
  accentColor?: string
  reduceAnim?: boolean
  notifInApp?: boolean
}

const prefsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  accentColor: z.string().max(20).optional(),
  reduceAnim: z.boolean().optional(),
  notifInApp: z.boolean().optional(),
})

/** GET /api/user/preferences — returns stored preferences */
export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { settings: true },
    })

    const stored = (profile?.settings as Record<string, unknown> | null) ?? {}
    const prefs: UserPreferences = {
      theme: (stored.theme as UserPreferences['theme']) ?? 'system',
      accentColor: (stored.accentColor as string) ?? '#007AFF',
      reduceAnim: (stored.reduceAnim as boolean) ?? false,
      notifInApp: (stored.notifInApp as boolean) ?? true,
    }

    return NextResponse.json(prefs)
  } catch {
    return NextResponse.json({
      theme: 'system',
      accentColor: '#007AFF',
      reduceAnim: false,
      notifInApp: true,
    } satisfies UserPreferences)
  }
}

/** PATCH /api/user/preferences — merges partial updates into settings */
export async function PATCH(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  let body: z.infer<typeof prefsSchema>
  try {
    const raw = (await request.json()) as unknown
    const parsed = prefsSchema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid preferences payload')
    body = parsed.data
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body')
  }

  try {
    // Read current settings first, then merge
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { settings: true },
    })

    const current = (profile?.settings as Record<string, unknown> | null) ?? {}
    const merged = { ...current, ...body }

    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, settings: merged },
      update: { settings: merged },
    })

    return NextResponse.json({ ok: true, preferences: merged })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to save preferences')
  }
}
