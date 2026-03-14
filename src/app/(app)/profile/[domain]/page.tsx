import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { OverviewSection } from '@/components/profile/sections/OverviewSection'
import { NutritionSection } from '@/components/profile/sections/NutritionSection'
import { TrainingSection } from '@/components/profile/sections/TrainingSection'
import { HealthSection } from '@/components/profile/sections/HealthSection'
import { MindfulnessSection } from '@/components/profile/sections/MindfulnessSection'
import { IdeasSection } from '@/components/profile/sections/IdeasSection'

// Profile domains map to TEAM agent groups:
//   nutrizione  → TEAM/nutrizione  (dietista, chef, endocrinologo)
//   salute      → TEAM/salute-biologica (mmg, gastroenterologo, cardiologo, dermatologo)
//   allenamento → TEAM/allenamento (persona-trainer, chinesologo, medico-dello-sport, fisioterapista, fisiatra, sleep-coach)
//   mindfulness → TEAM/salute-mentale (psicologo, mental-coach, coach-relazionale)
//   idee        → TEAM/idee (analista-contesto, financial-planner, commercialista, career-coach, executive-coach, life-organizer, consulente-legale)
// Settings are at /settings (separate route — not part of the profile)

const VALID_DOMAINS = [
  'overview',
  'nutrizione',
  'allenamento',
  'salute',
  'mindfulness',
  'idee',
] as const

type Domain = (typeof VALID_DOMAINS)[number]

async function fetchProfileData(userId: string) {
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
    recentWorkouts,
    recentMeals,
    recentMindfulness,
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
      take: 6,
      select: { id: true, type: true, title: true, contentMarkdown: true, createdAt: true },
    }),
    prisma.conversation.count({ where: { userId } }),
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: since7d } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, durationMin: true, perceivedEffort: true, notes: true, date: true },
    }),
    prisma.meal.findMany({
      where: { createdByUserId: userId, date: { gte: since7d } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, mealType: true, date: true, notes: true, items: true },
    }),
    prisma.mindfulnessEntry.findMany({
      where: { userId, createdAt: { gte: since7d } },
      orderBy: { createdAt: 'desc' },
      take: 7,
      select: { id: true, mood: true, stress: true, content: true, createdAt: true },
    }),
  ])

  return {
    user: { name: user?.name ?? null, email: user?.email ?? '' },
    profile,
    stats: {
      workoutSessions7d: workoutStats._count.id,
      totalWorkoutMin7d: workoutStats._sum.durationMin ?? 0,
      avgMood7d: moodStats._avg.mood ?? null,
      avgStress7d: moodStats._avg.stress ?? null,
      mealsLogged7d: mealCount,
      lastWeightEntry: lastWeight
        ? { value: lastWeight.value, unit: lastWeight.unit ?? 'kg', date: lastWeight.recordedAt }
        : null,
      conversationCount: convCount,
    },
    artifacts,
    recentWorkouts,
    recentMeals: recentMeals.map((m) => ({
      ...m,
      items: m.items as Record<string, unknown>[],
    })),
    recentMindfulness,
  }
}

export type ProfileData = Awaited<ReturnType<typeof fetchProfileData>>

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params

  if (!VALID_DOMAINS.includes(domain as Domain)) {
    redirect('/profile/overview')
  }

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const data = await fetchProfileData(session.user.id)

  switch (domain as Domain) {
    case 'overview':
      return <OverviewSection data={data} />
    case 'nutrizione':
      return <NutritionSection data={data} />
    case 'allenamento':
      return <TrainingSection data={data} />
    case 'salute':
      return <HealthSection data={data} />
    case 'mindfulness':
      return <MindfulnessSection data={data} />
    case 'idee':
      return <IdeasSection data={data} />
  }
}
