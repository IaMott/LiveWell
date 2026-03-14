import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `profile-read:${userId}:${getClientIp(request)}`, max: 60 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [user, profile, workoutStats, moodStats, mealCount, lastWeight, artifacts, convCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.workoutSession.aggregate({
        where: { userId, date: { gte: since7d } },
        _count: { id: true },
        _sum: { durationMin: true },
      }),
      prisma.mindfulnessEntry.aggregate({
        where: { userId, createdAt: { gte: since7d } },
        _avg: { mood: true, stress: true },
      }),
      prisma.meal.count({ where: { createdByUserId: userId, date: { gte: since7d } } }),
      prisma.bodyMetricEntry.findFirst({
        where: { userId, metricType: 'weight' },
        orderBy: { recordedAt: 'desc' },
        select: { value: true, unit: true, recordedAt: true },
      }),
      prisma.recommendationArtifact.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, type: true, title: true, contentMarkdown: true, createdAt: true },
      }),
      prisma.conversation.count({ where: { userId } }),
    ])

  return Response.json({
    user: { name: user?.name ?? null, email: user?.email ?? '' },
    profile: profile
      ? {
          birthDate: profile.birthDate?.toISOString() ?? null,
          gender: profile.gender ?? null,
          height: profile.height ?? null,
          weight: profile.weight ?? null,
          health: profile.health ?? null,
          nutrition: profile.nutrition ?? null,
          training: profile.training ?? null,
          mindfulness: profile.mindfulness ?? null,
          goals: profile.goals ?? null,
          settings: profile.settings ?? null,
        }
      : null,
    stats: {
      workoutSessions7d: workoutStats._count.id,
      totalWorkoutMin7d: workoutStats._sum.durationMin ?? 0,
      avgMood7d: moodStats._avg.mood ?? null,
      avgStress7d: moodStats._avg.stress ?? null,
      mealsLogged7d: mealCount,
      lastWeightEntry: lastWeight
        ? {
            value: lastWeight.value,
            unit: lastWeight.unit ?? 'kg',
            date: lastWeight.recordedAt.toISOString(),
          }
        : null,
      conversationCount: convCount,
    },
    recentArtifacts: artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      contentMarkdown: a.contentMarkdown,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

const VALID_SECTIONS = [
  'personal',
  'nutrition',
  'training',
  'health',
  'mindfulness',
  'goals',
  'settings',
] as const
type Section = (typeof VALID_SECTIONS)[number]

export async function PUT(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `profile-write:${userId}:${getClientIp(request)}`, max: 30 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: { section?: string; data?: Record<string, unknown> }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  const { section, data } = body
  if (!section || !data || typeof data !== 'object') {
    return errorResponse(400, 'BAD_REQUEST', 'Missing section or data')
  }
  if (!VALID_SECTIONS.includes(section as Section)) {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid section')
  }

  if (section === 'personal') {
    const { name, birthDate, gender, height, weight } = data as {
      name?: string
      birthDate?: string
      gender?: string
      height?: number
      weight?: number
    }

    await prisma.$transaction([
      ...(name !== undefined
        ? [
            prisma.user.update({
              where: { id: userId },
              data: { name: String(name).slice(0, 100) },
            }),
          ]
        : []),
      prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          gender: gender ? String(gender).slice(0, 20) : undefined,
          height: height != null ? Number(height) : undefined,
          weight: weight != null ? Number(weight) : undefined,
        },
        update: {
          ...(birthDate !== undefined && { birthDate: new Date(birthDate) }),
          ...(gender !== undefined && { gender: String(gender).slice(0, 20) }),
          ...(height !== undefined && { height: Number(height) }),
          ...(weight !== undefined && { weight: Number(weight) }),
        },
      }),
    ])
    return Response.json({ ok: true })
  }

  // JSON section upsert
  const sectionKey = section as Exclude<Section, 'personal'>
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, [sectionKey]: data },
    update: { [sectionKey]: data },
  })

  return Response.json({ ok: true })
}
