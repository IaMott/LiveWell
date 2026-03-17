import { Prisma } from '@prisma/client'
import { buildContextPack } from '@/lib/ai/context/contextPackBuilder'
import { prisma } from '@/lib/prisma'
import { upsertConversationSummary } from '@/lib/ai/longTermMemory'
import type { AgentProposal, ContextPack, Role } from '@/lib/ai/types'
import type { MutationAuditEvent } from '@/lib/tools/toolExecutor'

export function isDbPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test' || process.env.ENABLE_DB_IN_TEST === '1'
}

export function buildDefaultContextPack(userId: string, role: Role): ContextPack {
  return {
    user: { id: userId, role, profile: {} },
    history: { recentMessages: [], recentArtifacts: [] },
    trackers: {},
    notifications: { unreadCount: 0 },
    files: [],
    ui: { moodScore: 50, sectionScores: { general: 50 } },
  }
}

export type RoutePersistenceDeps = {
  findConversationById: (id: string) => Promise<{ id: string; userId: string } | null>
  createConversation: (input: {
    id?: string
    userId: string
    title: string
  }) => Promise<{ id: string }>
  persistChatTurn: (input: {
    userId: string
    conversationId: string
    userMessage: string
    assistantMessage: string
    domain?: string
    specialistName?: string
    auditEvents: MutationAuditEvent[]
    round1Proposals?: AgentProposal[]
    round2Proposals?: AgentProposal[]
    toolExecutionTrace?: Array<{
      toolCallId: string
      name: string
      ok: boolean
      code?: string
      message?: string
    }>
  }) => Promise<void>
  buildContextPack: (input: {
    userId: string
    conversationId: string
    role: Role
  }) => Promise<ContextPack>
}

export function createDbPersistenceDeps(enabled: boolean): RoutePersistenceDeps {
  if (!enabled) {
    return {
      findConversationById: async () => null,
      createConversation: async ({ id }) => ({ id: id ?? crypto.randomUUID() }),
      persistChatTurn: async () => undefined,
      buildContextPack: async ({ userId, role }) => buildDefaultContextPack(userId, role),
    }
  }

  type GenericFindUnique = (args: Record<string, unknown>) => Promise<unknown>

  function getFindUnique(modelName: string): GenericFindUnique | null {
    const prismaRecord = prisma as unknown as Record<string, unknown>
    const delegate = prismaRecord[modelName] as { findUnique?: GenericFindUnique } | undefined
    return delegate?.findUnique ?? null
  }

  async function findUniqueIfAvailable<T>(
    modelName: string,
    args: Record<string, unknown>,
  ): Promise<T | null> {
    const findUnique = getFindUnique(modelName)
    if (!findUnique) return null
    try {
      return (await findUnique(args)) as T | null
    } catch {
      return null
    }
  }

  return {
    findConversationById: async (id) =>
      prisma.conversation.findUnique({
        where: { id },
        select: { id: true, userId: true },
      }),
    createConversation: async ({ id, userId, title }) =>
      prisma.conversation.create({
        data: { ...(id ? { id } : {}), userId, title },
        select: { id: true },
      }),
    persistChatTurn: async ({
      userId,
      conversationId,
      userMessage,
      assistantMessage,
      domain,
      specialistName,
      auditEvents,
      round1Proposals,
      round2Proposals,
      toolExecutionTrace,
    }) => {
      // ── Phase 1: Critical — conversation + messages ──────────────────────
      // Sequential saves (no $transaction) for maximum compatibility with Neon
      // serverless connection pooling. Each operation is isolated; partial failures
      // are tolerated — the next save is still attempted.
      await prisma.conversation.upsert({
        where: { id: conversationId },
        create: { id: conversationId, userId, title: userMessage.slice(0, 80) },
        update: {},
      })

      await prisma.message.create({
        data: { conversationId, role: 'user', content: userMessage },
      })

      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: assistantMessage,
          ...(domain ? { domain } : {}),
          ...(specialistName ? { specialistName } : {}),
        },
      })

      for (const event of auditEvents) {
        try {
          await prisma.toolAuditLog.create({
            data: {
              userId: event.actorUserId,
              conversationId: event.conversationId,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              inputSummary: event.inputSummary,
              inputHash: event.inputHash,
              status: event.status,
              requestId: event.requestId,
              errorCode: event.errorCode ?? null,
            },
          })
        } catch {
          // non-critical
        }
      }

      // ── Phase 2: Best-effort — agent workspace upserts ───────────────────
      // These are non-critical; failures are tolerated so messages are always saved.
      const byAgent = new Map<string, { round1?: AgentProposal; round2?: AgentProposal }>()
      for (const p of round1Proposals ?? []) {
        const cur = byAgent.get(p.agentId) ?? {}
        cur.round1 = p
        byAgent.set(p.agentId, cur)
      }
      for (const p of round2Proposals ?? []) {
        const cur = byAgent.get(p.agentId) ?? {}
        cur.round2 = p
        byAgent.set(p.agentId, cur)
      }

      for (const [agentId, rounds] of byAgent.entries()) {
        try {
          await prisma.agentWorkspace.upsert({
            where: { conversationId_agentId: { conversationId, agentId } },
            create: {
              userId,
              conversationId,
              agentId,
              round1Proposal: rounds.round1
                ? (rounds.round1 as unknown as Prisma.InputJsonValue)
                : undefined,
              round2Proposal: rounds.round2
                ? (rounds.round2 as unknown as Prisma.InputJsonValue)
                : undefined,
            },
            update: {
              round1Proposal: rounds.round1
                ? (rounds.round1 as unknown as Prisma.InputJsonValue)
                : undefined,
              round2Proposal: rounds.round2
                ? (rounds.round2 as unknown as Prisma.InputJsonValue)
                : undefined,
            },
          })
        } catch {
          // non-critical: workspace upsert failure does not block message persistence
        }
      }

      if (toolExecutionTrace && toolExecutionTrace.length > 0) {
        try {
          await prisma.agentWorkspace.upsert({
            where: {
              conversationId_agentId: { conversationId, agentId: 'orchestratore-trace' },
            },
            create: {
              userId,
              conversationId,
              agentId: 'orchestratore-trace',
              round2Proposal: {
                summary: 'Tool execution trace',
                toolExecutionTrace,
              } as unknown as Prisma.InputJsonValue,
            },
            update: {
              round2Proposal: {
                summary: 'Tool execution trace',
                toolExecutionTrace,
              } as unknown as Prisma.InputJsonValue,
            },
          })
        } catch {
          // non-critical
        }
      }

      // ── Phase 3: Long-term memory — fire-and-forget summary upsert ────────
      // Persist a short cross-conversation summary so future turns can reference it.
      // messageCount=99 bypasses the MIN_MESSAGES gate (we always want a summary after a turn).
      upsertConversationSummary({
        userId,
        conversationId,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantMessage },
        ],
        domain: domain ?? 'general',
        messageCount: 99,
      })
    },
    buildContextPack: async ({ userId, conversationId, role }) => {
      try {
        return await buildContextPack({
          userId,
          conversationId,
          includeFileExtracts: true,
          db: {
            user: {
              findUnique: async () =>
                prisma.user.findUnique({
                  where: { id: userId },
                  select: { id: true, name: true },
                }) as Promise<{ id: string; role?: string; name?: string | null } | null>,
            },
            message: {
              findMany: async (args) =>
                prisma.message.findMany({
                  ...(args as object),
                  select: { role: true, content: true, createdAt: true },
                }) as Promise<
                  Array<{ role: 'user' | 'assistant'; content: string; createdAt: Date }>
                >,
            },
            recommendationArtifact: {
              findMany: async (args) =>
                prisma.recommendationArtifact
                  .findMany({
                    ...(args as object),
                    select: { type: true, title: true, createdAt: true, contentMarkdown: true },
                  })
                  .then((rows) => rows.map((r) => ({ ...r, content: r.contentMarkdown }))),
            },
            notification: {
              count: async (args) => prisma.notification.count(args as object),
              findFirst: async (args) =>
                prisma.notification.findFirst({
                  ...(args as object),
                  select: { createdAt: true },
                }) as Promise<{ createdAt: Date } | null>,
            },
            userProfile: {
              findUnique: async () =>
                prisma.userProfile.findUnique({ where: { userId } }) as Promise<Record<
                  string,
                  unknown
                > | null>,
            },
            medicalInfo: {
              findUnique: async (args) =>
                findUniqueIfAvailable<Record<string, unknown>>(
                  'medicalInfo',
                  args as Record<string, unknown>,
                ),
            },
            bodyMetricEntry: {
              findMany: async (args) =>
                prisma.bodyMetricEntry.findMany(args as object) as Promise<
                  Record<string, unknown>[]
                >,
            },
            meal: {
              findMany: async (args) =>
                prisma.meal.findMany(args as object) as Promise<Record<string, unknown>[]>,
            },
            workoutSession: {
              findMany: async (args) =>
                prisma.workoutSession.findMany(args as object) as Promise<
                  Record<string, unknown>[]
                >,
            },
            mindfulnessEntry: {
              findMany: async (args) =>
                prisma.mindfulnessEntry.findMany(args as object) as Promise<
                  Record<string, unknown>[]
                >,
            },
            fileAsset: {
              findMany: async (args) =>
                prisma.fileAsset.findMany({
                  ...(args as object),
                  select: {
                    id: true,
                    filename: true,
                    mimeType: true,
                    size: true,
                    extractedText: true,
                    url: true,
                  },
                }),
            },
            userAttribute: {
              findMany: async (args) =>
                prisma.userAttribute.findMany(args as object) as Promise<
                  Array<{
                    domain: string
                    key: string
                    value: unknown
                    unit: string | null
                    recordedAt: Date
                    notes: string | null
                    source?: string | null
                  }>
                >,
            },
            agentWorkspace: {
              findMany: async (args) =>
                prisma.agentWorkspace.findMany(args as object) as Promise<
                  Array<{
                    agentId: string
                    round1Proposal?: unknown
                    round2Proposal?: unknown
                    updatedAt: Date
                  }>
                >,
            },
            geoPreference: {
              findUnique: async () =>
                prisma.geoPreference.findUnique({
                  where: { userId },
                  select: {
                    enabled: true,
                    country: true,
                    region: true,
                    city: true,
                    timezone: true,
                    accuracy: true,
                  },
                }),
            },
          },
        })
      } catch {
        return buildDefaultContextPack(userId, role)
      }
    },
  }
}

export async function resolveConversationId(
  deps: RoutePersistenceDeps,
  input: { conversationId?: string; userId: string; message: string },
): Promise<string> {
  if (input.conversationId) {
    const existing = await deps.findConversationById(input.conversationId)
    if (existing && existing.userId === input.userId) return existing.id
    const created = await deps.createConversation({
      id: input.conversationId,
      userId: input.userId,
      title: input.message.slice(0, 80),
    })
    return created.id
  }
  const created = await deps.createConversation({
    userId: input.userId,
    title: input.message.slice(0, 80),
  })
  return created.id
}
