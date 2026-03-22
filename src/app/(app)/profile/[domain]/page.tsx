import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { NutritionSection } from '@/components/profile/sections/NutritionSection'
import { TrainingSection } from '@/components/profile/sections/TrainingSection'
import { HealthSection } from '@/components/profile/sections/HealthSection'
import { MindfulnessSection } from '@/components/profile/sections/MindfulnessSection'
import { IdeasSection } from '@/components/profile/sections/IdeasSection'
import { CartellaSection } from '@/components/profile/sections/CartellaSection'

// Profile domains map to TEAM agent groups:
//   nutrizione  → TEAM/nutrizione  (dietista, chef, endocrinologo)
//   salute      → TEAM/salute-biologica (mmg, gastroenterologo, cardiologo, dermatologo)
//   allenamento → TEAM/allenamento (persona-trainer, chinesologo, medico-dello-sport, fisioterapista, fisiatra, sleep-coach)
//   mindfulness → TEAM/salute-mentale (psicologo, mental-coach, coach-relazionale)
//   idee        → TEAM/idee (analista-contesto, financial-planner, commercialista, career-coach, executive-coach, life-organizer, consulente-legale)
// Settings are at /settings (separate route — not part of the profile)

const VALID_DOMAINS = [
  'cartella',
  'nutrizione',
  'allenamento',
  'salute',
  'mindfulness',
  'idee',
] as const

type Domain = (typeof VALID_DOMAINS)[number]

type AttrRow = {
  domain: string
  key: string
  value: unknown
  unit: string | null
  recordedAt: Date
}

function groupAttributesByDomain(
  attrs: AttrRow[],
): Record<string, Record<string, { value: unknown; unit: string | null }>> {
  const result: Record<string, Record<string, { value: unknown; unit: string | null }>> = {}
  for (const attr of attrs) {
    if (!result[attr.domain]) result[attr.domain] = {}
    if (!result[attr.domain][attr.key]) {
      // First occurrence wins (already ordered by recordedAt desc)
      result[attr.domain][attr.key] = { value: attr.value, unit: attr.unit }
    }
  }
  return result
}

type AttrHistory = { value: unknown; unit: string | null; recordedAt: Date }

function groupAttributesByDomainWithHistory(
  attrs: AttrRow[],
): Record<string, Record<string, AttrHistory[]>> {
  const result: Record<string, Record<string, AttrHistory[]>> = {}
  for (const attr of attrs) {
    if (!result[attr.domain]) result[attr.domain] = {}
    if (!result[attr.domain][attr.key]) result[attr.domain][attr.key] = []
    result[attr.domain][attr.key].push({
      value: attr.value,
      unit: attr.unit,
      recordedAt: attr.recordedAt,
    })
  }
  return result
}

async function fetchProfileData(userId: string) {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    user,
    profile,
    workoutStats,
    moodStats,
    mealCount,
    lastWeight,
    artifacts,
    recentWorkouts,
    recentMeals,
    recentMindfulness,
    dynamicAttribs,
    bodyMetrics30d,
    allAttributes,
    workoutPlan,
    allArtifacts,
    clinicalEvents,
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
    // Dynamic attributes captured by agents via chat (fallback when UserProfile is null)
    prisma.userAttribute.findMany({
      where: {
        userId,
        domain: { in: ['health', 'personal', 'nutrition'] },
        key: {
          in: [
            'weight',
            'height',
            'gender',
            'birthDate',
            'age',
            'allergy',
            'conditions',
            'medications',
          ],
        },
      },
      orderBy: { recordedAt: 'desc' },
      select: { domain: true, key: true, value: true, unit: true, recordedAt: true },
    }),
    // Body metrics history (last 30 days, weight only)
    prisma.bodyMetricEntry.findMany({
      where: { userId, metricType: 'weight', recordedAt: { gte: since30d } },
      orderBy: { recordedAt: 'asc' },
      select: { value: true, unit: true, recordedAt: true },
    }),
    // All user attributes from all domains
    prisma.userAttribute.findMany({
      where: {
        userId,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      orderBy: { recordedAt: 'desc' },
      take: 500,
      select: { domain: true, key: true, value: true, unit: true, recordedAt: true },
    }),
    // Latest workout plan
    prisma.workoutPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, weeklyDays: true, sessions: true, createdAt: true },
    }),
    // All recommendation artifacts (up to 20)
    prisma.recommendationArtifact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, title: true, contentMarkdown: true, createdAt: true },
    }),
    // Cartella clinica: eventi strutturati registrati dagli agenti
    prisma.clinicalEvent.findMany({
      where: { userId },
      orderBy: { eventDate: 'desc' },
      take: 100,
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        domain: true,
        agentId: true,
        eventDate: true,
        validUntil: true,
        severity: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ])

  // Build a merged profile: UserProfile takes precedence, dynamic attrs fill gaps
  function getAttrValue(key: string): unknown {
    return dynamicAttribs.find((a) => a.key === key || a.key.toLowerCase() === key.toLowerCase())
      ?.value
  }

  const mergedWeight =
    profile?.weight ??
    (typeof getAttrValue('weight') === 'number' ? (getAttrValue('weight') as number) : null)
  const mergedHeight =
    profile?.height ??
    (typeof getAttrValue('height') === 'number' ? (getAttrValue('height') as number) : null)
  const mergedGender =
    profile?.gender ??
    (typeof getAttrValue('gender') === 'string' ? (getAttrValue('gender') as string) : null)

  // Birth date: from profile or derived from age attribute
  let mergedBirthDate: Date | null = profile?.birthDate ?? null
  if (!mergedBirthDate) {
    const ageVal = getAttrValue('age')
    const birthDateVal = getAttrValue('birthDate')
    if (birthDateVal && typeof birthDateVal === 'string') {
      const d = new Date(birthDateVal)
      if (!isNaN(d.getTime())) mergedBirthDate = d
    } else if (typeof ageVal === 'number' && ageVal > 0) {
      const birthYear = new Date().getFullYear() - Math.round(ageVal)
      mergedBirthDate = new Date(`${birthYear}-01-01`)
    }
  }

  // Build merged profile object for display (null when nothing known)
  const displayProfile =
    mergedWeight || mergedHeight || mergedGender || mergedBirthDate
      ? {
          ...(profile ?? {}),
          weight: mergedWeight,
          height: mergedHeight,
          gender: mergedGender,
          birthDate: mergedBirthDate,
        }
      : profile

  return {
    user: { name: user?.name ?? null, email: user?.email ?? '' },
    profile: displayProfile as typeof profile,
    stats: {
      workoutSessions7d: workoutStats._count.id,
      totalWorkoutMin7d: workoutStats._sum.durationMin ?? 0,
      avgMood7d: moodStats._avg.mood ?? null,
      avgStress7d: moodStats._avg.stress ?? null,
      mealsLogged7d: mealCount,
      lastWeightEntry: lastWeight
        ? { value: lastWeight.value, unit: lastWeight.unit ?? 'kg', date: lastWeight.recordedAt }
        : null,
    },
    artifacts,
    recentWorkouts,
    recentMeals: recentMeals.map((m) => ({
      ...m,
      items: m.items as Record<string, unknown>[],
    })),
    recentMindfulness,
    bodyMetrics30d,
    allAttributes,
    attributesByDomain: groupAttributesByDomain(allAttributes),
    attributesByDomainHistory: groupAttributesByDomainWithHistory(allAttributes),
    workoutPlan,
    allArtifacts,
    clinicalEvents,
  }
}

export type ProfileData = Awaited<ReturnType<typeof fetchProfileData>>

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params

  if (domain === 'overview') {
    redirect('/profile/cartella')
  }

  if (!VALID_DOMAINS.includes(domain as Domain)) {
    redirect('/profile/cartella')
  }

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const data = await fetchProfileData(session.user.id)

  switch (domain as Domain) {
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
    case 'cartella':
      return <CartellaSection data={data} />
  }
}
