import { ContextPack, Domain, Role, UserAttributes, AttributeValue } from '../types'

type QueryArgs = Record<string, unknown>
type UnknownRecord = Record<string, unknown>
type DateCarrier = { createdAt: Date | string }

type RawAttribute = {
  domain: string
  key: string
  value: unknown
  unit: string | null
  recordedAt: Date | string
  notes: string | null
  source?: string | null
}

export type DbClient = {
  user: {
    findUnique: (args: QueryArgs) => Promise<{ id: string; role?: string } | null>
  }
  message: {
    findMany: (
      args: QueryArgs,
    ) => Promise<Array<{ role: 'user' | 'assistant'; content: string; createdAt: Date | string }>>
  }
  recommendationArtifact: {
    findMany: (
      args: QueryArgs,
    ) => Promise<
      Array<{ type: string; title: string; createdAt: Date | string; content?: string | null }>
    >
  }
  notification: {
    count: (args: QueryArgs) => Promise<number>
    findFirst: (args: QueryArgs) => Promise<DateCarrier | null>
  }
  userProfile: {
    findUnique: (args: QueryArgs) => Promise<UnknownRecord | null>
  }
  medicalInfo: {
    findUnique: (args: QueryArgs) => Promise<UnknownRecord | null>
  }
  bodyMetricEntry: {
    findMany: (args: QueryArgs) => Promise<unknown[]>
  }
  meal: { findMany: (args: QueryArgs) => Promise<unknown[]> }
  workoutSession: { findMany: (args: QueryArgs) => Promise<unknown[]> }
  mindfulnessEntry: { findMany: (args: QueryArgs) => Promise<unknown[]> }
  fileAsset: {
    findMany: (args: QueryArgs) => Promise<
      Array<{
        id: string
        filename: string
        mimeType: string
        size: number
        extractedText?: string | null
        url?: string | null
      }>
    >
  }
  // Dynamic attribute store — optional for test backwards compat
  userAttribute?: {
    findMany: (args: QueryArgs) => Promise<RawAttribute[]>
  }
  // Optional geo preference (privacy-first)
  geoPreference?: {
    findUnique: (args: QueryArgs) => Promise<{
      enabled: boolean
      country?: string | null
      region?: string | null
      city?: string | null
      timezone?: string | null
      accuracy?: string | null
    } | null>
  }
}

export type ContextPackBuilderOptions = {
  userId: string
  conversationId: string
  db: DbClient
  nowIso?: string
  includeFileExtracts?: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function computeMoodScore(input: {
  last7Weights?: number[]
  last7Workouts?: number
  last7MealsLogged?: number
  last7MindfulnessEntries?: number
}): number {
  const w = input.last7Workouts ?? 0
  const m = input.last7MealsLogged ?? 0
  const me = input.last7MindfulnessEntries ?? 0
  const raw = 40 + w * 6 + m * 2 + me * 4
  return clamp(raw, 0, 100)
}

function computeSectionScores(input: {
  workouts: number
  meals: number
  mindfulness: number
  metrics: number
}): Partial<Record<Domain, number>> {
  return {
    training: clamp(30 + input.workouts * 10, 0, 100),
    nutrition: clamp(30 + input.meals * 6, 0, 100),
    mindfulness: clamp(30 + input.mindfulness * 10, 0, 100),
    health: clamp(30 + input.metrics * 12, 0, 100),
    general: 50,
    inspiration: 50,
  }
}

/**
 * Collapse a flat list of UserAttribute rows into a UserAttributes map.
 * Only keeps the most recent record per (domain, key) — rows must be
 * pre-sorted by recordedAt DESC.
 */
function buildAttributeMap(rows: RawAttribute[]): UserAttributes {
  const seen = new Set<string>()
  const result: UserAttributes = {}
  const domainResult = result as Record<string, Record<string, AttributeValue>>

  for (const row of rows) {
    const compositeKey = `${row.domain}:${row.key}`
    if (seen.has(compositeKey)) continue // already have the most recent
    seen.add(compositeKey)

    const domainKey = row.domain as keyof UserAttributes
    if (!domainResult[domainKey]) domainResult[domainKey] = {}
    const attrValue: AttributeValue = {
      value: row.value,
      unit: row.unit ?? undefined,
      recordedAt: new Date(row.recordedAt).toISOString(),
      notes: row.notes ?? undefined,
      source: row.source ?? undefined,
    }
    domainResult[domainKey][row.key] = attrValue
  }

  return result
}

export async function buildContextPack(opts: ContextPackBuilderOptions): Promise<ContextPack> {
  void opts.nowIso

  const [user, userProfile, medicalInfo] = await Promise.all([
    opts.db.user.findUnique({ where: { id: opts.userId }, select: { id: true, role: true } }),
    opts.db.userProfile.findUnique({ where: { userId: opts.userId } }),
    opts.db.medicalInfo.findUnique({ where: { userId: opts.userId } }),
  ])

  // Current conversation messages (full context for this session)
  const recentMessages = await opts.db.message.findMany({
    where: { conversationId: opts.conversationId },
    orderBy: { createdAt: 'desc' },
    take: 24,
    select: { role: true, content: true, createdAt: true },
  })

  // Cross-conversation memory: last 15 messages from OTHER conversations
  // Enables agents to recall facts mentioned in previous sessions
  const crossConvMessages = await opts.db.message
    .findMany({
      where: {
        conversation: { userId: opts.userId },
        NOT: { conversationId: opts.conversationId },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { role: true, content: true, createdAt: true },
    })
    .catch(
      () => [] as Array<{ role: 'user' | 'assistant'; content: string; createdAt: Date | string }>,
    )

  const recentArtifacts = await opts.db.recommendationArtifact.findMany({
    where: { relatedConversationId: opts.conversationId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { type: true, title: true, createdAt: true, content: true },
  })

  const [unreadCount, lastNotification] = await Promise.all([
    opts.db.notification.count({ where: { userId: opts.userId, readAt: null } }),
    opts.db.notification.findFirst({
      where: { userId: opts.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  // Trackers (last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [metrics, meals, workouts, mind] = await Promise.all([
    opts.db.bodyMetricEntry.findMany({
      where: { userId: opts.userId, recordedAt: { gte: since } },
      take: 50,
    }),
    opts.db.meal.findMany({
      where: { createdByUserId: opts.userId, date: { gte: since } },
      take: 50,
    }),
    opts.db.workoutSession.findMany({
      where: { userId: opts.userId, date: { gte: since } },
      take: 50,
    }),
    opts.db.mindfulnessEntry.findMany({
      where: { userId: opts.userId, createdAt: { gte: since } },
      take: 50,
    }),
  ])

  // Dynamic user attributes — most recent per (domain, key)
  // Only valid attributes (not yet expired)
  let userAttributes: UserAttributes = {}
  if (opts.db.userAttribute) {
    const attrRows = await opts.db.userAttribute
      .findMany({
        where: {
          userId: opts.userId,
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
        orderBy: { recordedAt: 'desc' },
        take: 200,
        select: {
          domain: true,
          key: true,
          value: true,
          unit: true,
          recordedAt: true,
          notes: true,
          source: true,
        },
      })
      .catch(() => [] as RawAttribute[])
    userAttributes = buildAttributeMap(attrRows)
  }

  const moodScore = computeMoodScore({
    last7Workouts: workouts.length,
    last7MealsLogged: meals.length,
    last7MindfulnessEntries: mind.length,
  })

  const sectionScores = computeSectionScores({
    workouts: workouts.length,
    meals: meals.length,
    mindfulness: mind.length,
    metrics: metrics.length,
  })

  const files = await opts.db.fileAsset.findMany({
    where: { conversationId: opts.conversationId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      extractedText: true,
      url: true,
    },
  })

  // Geo: only if geoPreference.enabled (privacy contract)
  const geoRecord = opts.db.geoPreference
    ? await opts.db.geoPreference.findUnique({ where: { userId: opts.userId } })
    : null
  const geo = geoRecord?.enabled
    ? {
        country: geoRecord.country ?? null,
        region: geoRecord.region ?? null,
        city: geoRecord.city ?? null,
        timezone: geoRecord.timezone ?? null,
        accuracy: geoRecord.accuracy ?? null,
      }
    : undefined

  return {
    user: {
      id: user?.id ?? opts.userId,
      role: (user?.role as Role) ?? 'USER',
      profile: {
        ...(userProfile ?? {}),
        medicalInfo: medicalInfo ?? undefined,
      },
      // Agent-driven dynamic attributes (most recent per key)
      attributes: Object.keys(userAttributes).length > 0 ? userAttributes : undefined,
    },
    history: {
      recentMessages: recentMessages
        .slice()
        .reverse()
        .map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
      crossConversationMessages:
        crossConvMessages.length > 0
          ? crossConvMessages
              .slice()
              .reverse()
              .map((m) => ({
                role: m.role,
                content: m.content,
                createdAt: new Date(m.createdAt).toISOString(),
              }))
          : undefined,
      recentArtifacts: recentArtifacts.map((a) => ({
        type: a.type,
        title: a.title,
        createdAt: new Date(a.createdAt).toISOString(),
        contentMarkdown: a.content ?? undefined,
      })),
    },
    trackers: {
      health: { metricsCount7d: metrics.length },
      nutrition: { mealsCount7d: meals.length },
      training: { workoutsCount7d: workouts.length },
      mindfulness: { entriesCount7d: mind.length },
    },
    notifications: {
      unreadCount,
      lastSentAt: lastNotification?.createdAt
        ? new Date(lastNotification.createdAt).toISOString()
        : undefined,
    },
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      size: f.size,
      extractedText: opts.includeFileExtracts ? (f.extractedText ?? undefined) : undefined,
      url: f.url ?? undefined,
    })),
    ui: {
      moodScore,
      sectionScores,
    },
    geo,
  }
}
