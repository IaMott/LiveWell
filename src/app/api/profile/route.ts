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

  const [
    user,
    profile,
    workoutStats,
    moodStats,
    mealCount,
    lastWeight,
    artifacts,
    convCount,
  ] = await Promise.all([
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
