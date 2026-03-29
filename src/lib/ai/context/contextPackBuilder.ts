import { AttributeValue, ContextPack, Domain, Role, UserAttributes } from '../types'
import { stripAssistantStoredMetadata } from '@/lib/chat/thinkingPersistence'
import { computeMedicalRecord } from './medicalRecord'
import { getRecentConversationSummaries } from '../longTermMemory'

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
type WorkspaceRow = {
  agentId: string
  round1Proposal?: unknown
  round2Proposal?: unknown
  updatedAt: Date | string
}

type ToolExecutionTraceEntry = {
  toolCallId: string
  name: string
  ok: boolean
  code?: string
  message?: string
  createdAt: string
}

function isToolExecutionTraceEntry(value: unknown): value is ToolExecutionTraceEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.toolCallId === 'string' &&
    v.toolCallId.length > 0 &&
    typeof v.name === 'string' &&
    v.name.length > 0 &&
    typeof v.ok === 'boolean' &&
    typeof v.createdAt === 'string'
  )
}

export type DbClient = {
  user: {
    findUnique: (
      args: QueryArgs,
    ) => Promise<{ id: string; role?: string; name?: string | null } | null>
  }
  message: {
    findMany: (
      args: QueryArgs,
    ) => Promise<
      Array<{ id?: string; role: 'user' | 'assistant'; content: string; createdAt: Date | string }>
    >
  }
  recommendationArtifact: {
    findMany: (args: QueryArgs) => Promise<
      Array<{
        id?: string
        type: string
        title: string
        createdAt: Date | string
        content?: string | null
      }>
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
  // Nutrition / training / mindfulness as needed
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
        conversationId?: string | null
        createdAt?: Date | string
      }>
    >
  }
  userAttribute?: {
    findMany: (args: QueryArgs) => Promise<RawAttribute[]>
  }
  agentWorkspace?: {
    findMany: (args: QueryArgs) => Promise<WorkspaceRow[]>
  }
  messagereview?: {
    findMany: (args: QueryArgs) => Promise<Array<{ agentId: string | null; rating: number }>>
  }
  // Optional — geo preference (privacy-first: only coarse fields, never raw coords)
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

function buildAttributeMapWithHistory(rows: RawAttribute[]): {
  current: UserAttributes
  history: Record<
    string,
    Record<string, Array<{ value: unknown; recordedAt: string; notes?: string }>>
  >
} {
  const seenCurrent = new Set<string>()
  const current: UserAttributes = {}
  const history: Record<
    string,
    Record<string, Array<{ value: unknown; recordedAt: string; notes?: string }>>
  > = {}

  for (const row of rows) {
    const composite = `${row.domain}:${row.key}`

    // History: keep last 12 values per key (rows already sorted desc by recordedAt).
    // G1: 12 gives 3 months of weekly entries for clinical metrics like weight/pressure.
    if (!history[row.domain]) history[row.domain] = {}
    if (!history[row.domain][row.key]) history[row.domain][row.key] = []
    if (history[row.domain][row.key].length < 12) {
      history[row.domain][row.key].push({
        value: row.value,
        recordedAt: new Date(row.recordedAt).toISOString(),
        notes: row.notes ?? undefined,
      })
    }

    // Current: only first (most recent) occurrence per key
    if (seenCurrent.has(composite)) continue
    seenCurrent.add(composite)

    const domainKey = row.domain as keyof UserAttributes
    const bucket = (current[domainKey] ?? {}) as Record<string, AttributeValue>
    current[domainKey] = bucket as UserAttributes[keyof UserAttributes]
    bucket[row.key] = {
      value: row.value,
      unit: row.unit ?? undefined,
      recordedAt: new Date(row.recordedAt).toISOString(),
      notes: row.notes ?? undefined,
      source: row.source ?? undefined,
    }
  }

  return { current, history }
}

function readRefId(value: unknown, key: 'fileAssetId' | 'artifactId'): string | null {
  if (!value || typeof value !== 'object') return null
  const raw = (value as Record<string, unknown>)[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
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

// Mood is computed from real user signals; keep it simple and safe.
function computeMoodScore(input: {
  last7Weights?: number[]
  last7Workouts?: number
  last7MealsLogged?: number
  last7MindfulnessEntries?: number
}): number {
  const w = input.last7Workouts ?? 0
  const m = input.last7MealsLogged ?? 0
  const me = input.last7MindfulnessEntries ?? 0

  // Very rough heuristic: activity + tracking consistency
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

export async function buildContextPack(opts: ContextPackBuilderOptions): Promise<ContextPack> {
  void opts.nowIso

  const [user, userProfile, medicalInfo] = await Promise.all([
    opts.db.user.findUnique({
      where: { id: opts.userId },
      select: { id: true, role: true, name: true },
    }),
    opts.db.userProfile.findUnique({ where: { userId: opts.userId } }),
    opts.db.medicalInfo.findUnique({ where: { userId: opts.userId } }),
  ])

  const recentMessages = await opts.db.message.findMany({
    where: { conversationId: opts.conversationId },
    orderBy: { createdAt: 'desc' },
    take: 24,
    select: { id: true, role: true, content: true, createdAt: true },
  })

  const crossConversationMessages = await opts.db.message
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
    select: { id: true, type: true, title: true, createdAt: true, content: true },
  })

  const [unreadCount, lastNotification, conversationSummaries] = await Promise.all([
    opts.db.notification.count({ where: { userId: opts.userId, readAt: null } }),
    opts.db.notification.findFirst({
      where: { userId: opts.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    getRecentConversationSummaries(opts.userId, opts.conversationId).catch(() => []),
  ])

  // Trackers (last 7 days - simplified)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [metrics, meals, workouts, mind, workspaces] = await Promise.all([
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
    opts.db.agentWorkspace
      ? opts.db.agentWorkspace.findMany({
          where: { userId: opts.userId, conversationId: opts.conversationId },
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            agentId: true,
            round1Proposal: true,
            round2Proposal: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([] as WorkspaceRow[]),
  ])

  let userAttributes: UserAttributes = {}
  let userAttributeHistory: Record<
    string,
    Record<string, Array<{ value: unknown; recordedAt: string; notes?: string }>>
  > = {}
  let attributeRows: RawAttribute[] = []
  if (opts.db.userAttribute) {
    attributeRows = await opts.db.userAttribute
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
    const { current: builtAttributes, history: builtHistory } =
      buildAttributeMapWithHistory(attributeRows)
    userAttributes = builtAttributes
    userAttributeHistory = builtHistory
  }
  // G2: Signal when the EAV query hit the take:200 limit so agents know history may be incomplete.
  const hasMoreAttributes = attributeRows.length >= 200

  const fileNotesById = new Map<string, string>()
  const artifactNotesById = new Map<string, string>()
  for (const row of attributeRows) {
    if (!row.notes) continue
    if (row.key === 'attachment_file') {
      const fileAssetId = readRefId(row.value, 'fileAssetId')
      if (fileAssetId && !fileNotesById.has(fileAssetId)) fileNotesById.set(fileAssetId, row.notes)
    }
    if (row.key === 'generated_artifact') {
      const artifactId = readRefId(row.value, 'artifactId')
      if (artifactId && !artifactNotesById.has(artifactId))
        artifactNotesById.set(artifactId, row.notes)
    }
  }

  // Feedback scores — kept separate from clinical data, used for agent routing only
  const agentFeedbackScores: Record<string, number> = {}
  if (opts.db.messagereview) {
    try {
      const { createHash } = await import('node:crypto')
      const userHash = createHash('sha256').update(opts.userId).digest('hex').slice(0, 16)
      const reviews = await opts.db.messagereview.findMany({
        where: { userHash, agentId: { not: null } },
        select: { agentId: true, rating: true },
      })
      const agg: Record<string, { sum: number; count: number }> = {}
      for (const r of reviews) {
        if (!r.agentId) continue
        if (!agg[r.agentId]) agg[r.agentId] = { sum: 0, count: 0 }
        agg[r.agentId].sum += r.rating
        agg[r.agentId].count++
      }
      for (const [agentId, { sum, count }] of Object.entries(agg)) {
        if (count >= 3) agentFeedbackScores[agentId] = sum / count
      }
    } catch {
      // best-effort — feedback scoring is non-critical
    }
  }

  const medicalRecord = computeMedicalRecord(
    Object.keys(userAttributes).length > 0 ? userAttributes : undefined,
  )

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
    // Load files from all conversations for this user so agents can consult
    // historical documents (e.g. blood work from a previous session).
    where: { userId: opts.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      extractedText: true,
      url: true,
      conversationId: true,
      createdAt: true,
    },
  })

  // Geo: include ONLY if geoPreference.enabled (privacy contract — no raw coords exposed)
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

  const toolExecutionTrace: ToolExecutionTraceEntry[] = workspaces
    .filter((w) => w.agentId === 'orchestratore-trace')
    .flatMap((w) => {
      if (!w.round2Proposal || typeof w.round2Proposal !== 'object') return []
      const proposal = w.round2Proposal as Record<string, unknown>
      const raw = proposal.toolExecutionTrace
      if (!Array.isArray(raw)) return []
      return raw
        .map((entry): ToolExecutionTraceEntry | null => {
          if (!entry || typeof entry !== 'object') return null
          const obj = entry as Record<string, unknown>
          const toolCallId = typeof obj.toolCallId === 'string' ? obj.toolCallId : ''
          const name = typeof obj.name === 'string' ? obj.name : ''
          const ok = typeof obj.ok === 'boolean' ? obj.ok : false
          if (!toolCallId || !name) return null
          return {
            toolCallId,
            name,
            ok,
            code: typeof obj.code === 'string' ? obj.code : undefined,
            message: typeof obj.message === 'string' ? obj.message : undefined,
            createdAt: new Date(w.updatedAt).toISOString(),
          }
        })
        .filter(isToolExecutionTraceEntry)
    })

  return {
    user: {
      id: user?.id ?? opts.userId,
      role: (user?.role as Role) ?? 'USER',
      profile: {
        ...(userProfile ?? {}),
        medicalInfo: medicalInfo ?? undefined,
        // Inject account name so AI always knows the user's name
        ...(user?.name ? { name: user.name } : {}),
      },
      attributes: Object.keys(userAttributes).length > 0 ? userAttributes : undefined,
      attributeHistory:
        Object.keys(userAttributeHistory).length > 0 ? userAttributeHistory : undefined,
      hasMoreAttributes: hasMoreAttributes || undefined,
      medicalRecord,
    },
    history: {
      recentMessages: recentMessages
        .slice()
        .reverse()
        .map((m) => ({
          id: (m as { id?: string }).id ?? undefined,
          role: m.role,
          content: m.role === 'assistant' ? stripAssistantStoredMetadata(m.content) : m.content,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
      recentArtifacts: recentArtifacts.map((a) => ({
        type: a.type,
        title: a.title,
        createdAt: new Date(a.createdAt).toISOString(),
        contentMarkdown: a.content ?? undefined,
        notes:
          'id' in (a as Record<string, unknown>)
            ? artifactNotesById.get(String((a as Record<string, unknown>).id ?? ''))
            : undefined,
      })),
      agentWorkspaces:
        workspaces.length > 0
          ? workspaces.map((w) => {
              const r1 =
                w.round1Proposal && typeof w.round1Proposal === 'object'
                  ? ((w.round1Proposal as Record<string, unknown>).summary as string | undefined)
                  : undefined
              const r2Obj =
                w.round2Proposal && typeof w.round2Proposal === 'object'
                  ? (w.round2Proposal as Record<string, unknown>)
                  : undefined
              const r2 = r2Obj ? (r2Obj.summary as string | undefined) : undefined
              const pendingQuestionsRaw = r2Obj?.pendingQuestions
              const pendingQuestions =
                Array.isArray(pendingQuestionsRaw) && pendingQuestionsRaw.length > 0
                  ? pendingQuestionsRaw
                      .map((q) => (typeof q === 'string' ? q.trim() : ''))
                      .filter((q) => q.length > 0)
                  : undefined
              const pendingDomainRaw = r2Obj?.pendingDomain
              const pendingDomain =
                pendingDomainRaw === 'general' ||
                pendingDomainRaw === 'nutrition' ||
                pendingDomainRaw === 'health' ||
                pendingDomainRaw === 'training' ||
                pendingDomainRaw === 'mindfulness' ||
                pendingDomainRaw === 'inspiration' ||
                pendingDomainRaw === 'coordination'
                  ? (pendingDomainRaw as Domain)
                  : undefined
              return {
                agentId: w.agentId,
                round1Summary: r1,
                round2Summary: r2,
                pendingQuestions,
                pendingDomain,
                updatedAt: new Date(w.updatedAt).toISOString(),
              }
            })
          : undefined,
      toolExecutionTrace: toolExecutionTrace.length > 0 ? toolExecutionTrace : undefined,
      crossConversationMessages:
        crossConversationMessages.length > 0
          ? crossConversationMessages
              .slice()
              .reverse()
              .map((m) => ({
                role: m.role,
                content:
                  m.role === 'assistant' ? stripAssistantStoredMetadata(m.content) : m.content,
                createdAt: new Date(m.createdAt).toISOString(),
              }))
          : undefined,
      recentConversationSummaries:
        conversationSummaries.length > 0
          ? conversationSummaries.map((s) => ({
              conversationId: s.conversationId,
              summary: s.summary,
              domain: s.domain,
              updatedAt: s.updatedAt.toISOString(),
            }))
          : undefined,
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
      conversationId: f.conversationId ?? undefined,
      recordedAt: f.createdAt ? new Date(f.createdAt).toISOString() : undefined,
      notes: fileNotesById.get(f.id),
    })),
    ui: {
      moodScore,
      sectionScores,
    },
    geo,
    routing: {
      agentFeedbackScores:
        Object.keys(agentFeedbackScores).length > 0 ? agentFeedbackScores : undefined,
    },
  }
}
