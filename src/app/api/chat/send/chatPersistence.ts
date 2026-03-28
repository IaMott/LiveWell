import { Prisma } from '@prisma/client'
import type { CaseState } from '@/lib/ai/case/state'
import { toCanonicalCaseStateSnapshot } from '@/lib/ai/case/compat'
import { buildContextPack } from '@/lib/ai/context/contextPackBuilder'
import {
  type CanonicalCaseRuntimeState,
  fromStoredCaseState,
  readCanonicalCaseRuntimeState,
  toStoredCaseState,
  toStoredCaseRuntimeState,
} from '@/lib/ai/case/persistence'
import {
  encodeAssistantContentWithThinking,
  stripAssistantStoredMetadata,
  type PersistedThinkingStep,
} from '@/lib/chat/thinkingPersistence'
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
  getCaseRuntimeState: (input: {
    conversationId: string
  }) => Promise<CanonicalCaseRuntimeState | null>
  getCaseState: (input: { conversationId: string }) => Promise<CaseState | null>
  persistCaseRuntimeState: (input: {
    userId: string
    conversationId: string
    caseState: CanonicalCaseRuntimeState
  }) => Promise<void>
  persistCaseState: (input: {
    userId: string
    conversationId: string
    caseState: CaseState
  }) => Promise<void>
  persistChatTurn: (input: {
    userId: string
    conversationId: string
    userMessage: string
    assistantMessage: string
    assistantMessageId?: string
    thinkingTrace?: PersistedThinkingStep[]
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
    /** C1: Full conversation history for accurate long-term memory summaries. */
    recentMessages?: Array<{ role: string; content: string }>
    /** P5: FileAsset IDs uploaded with this user message — creates Attachment records. */
    fileIds?: string[]
    /** Multi-reply: ID of the assistant message this user message is replying to */
    replyToMessageId?: string
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
      getCaseRuntimeState: async () => null,
      getCaseState: async () => null,
      persistCaseRuntimeState: async () => undefined,
      persistCaseState: async () => undefined,
      persistChatTurn: async () => undefined,
      buildContextPack: async ({ userId, role }) => buildDefaultContextPack(userId, role),
    }
  }

  type GenericFindUnique = (args: Record<string, unknown>) => Promise<unknown>
  type GenericUpsert = (args: Record<string, unknown>) => Promise<unknown>

  function getFindUnique(modelName: string): GenericFindUnique | null {
    const prismaRecord = prisma as unknown as Record<string, unknown>
    const delegate = prismaRecord[modelName] as { findUnique?: GenericFindUnique } | undefined
    return delegate?.findUnique ?? null
  }

  function getUpsert(modelName: string): GenericUpsert | null {
    const prismaRecord = prisma as unknown as Record<string, unknown>
    const delegate = prismaRecord[modelName] as { upsert?: GenericUpsert } | undefined
    return delegate?.upsert ?? null
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

  async function upsertStoredCaseState(
    conversationId: string,
    userId: string,
    nextStored: Record<string, unknown>,
  ): Promise<void> {
    const upsert = getUpsert('caseState')
    if (!upsert) return

    await upsert({
      where: { conversationId },
      create: {
        userId,
        conversationId,
        ...nextStored,
      },
      update: nextStored,
    })
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
    getCaseRuntimeState: async ({ conversationId }) => {
      const row = await findUniqueIfAvailable<Record<string, unknown>>('caseState', {
        where: { conversationId },
      })
      return readCanonicalCaseRuntimeState(row)
    },
    getCaseState: async ({ conversationId }) => {
      const row = await findUniqueIfAvailable<Record<string, unknown>>('caseState', {
        where: { conversationId },
      })
      return fromStoredCaseState(row)
    },
    persistCaseRuntimeState: async ({ userId, conversationId, caseState }) => {
      const nextStored = toStoredCaseRuntimeState(caseState)
      await upsertStoredCaseState(conversationId, userId, nextStored)
    },
    persistCaseState: async ({ userId, conversationId, caseState }) => {
      const canonicalCaseState = toCanonicalCaseStateSnapshot(caseState)
      if (canonicalCaseState) {
        const nextStored = toStoredCaseRuntimeState(canonicalCaseState, caseState)
        await upsertStoredCaseState(conversationId, userId, nextStored)
        return
      }

      const nextStored = toStoredCaseState(caseState)
      await upsertStoredCaseState(conversationId, userId, nextStored)
    },
    persistChatTurn: async ({
      userId,
      conversationId,
      userMessage,
      assistantMessage,
      assistantMessageId,
      thinkingTrace,
      domain,
      specialistName,
      auditEvents,
      round1Proposals,
      round2Proposals,
      toolExecutionTrace,
      recentMessages,
      fileIds,
      replyToMessageId,
    }) => {
      // ── Phase 1: Critical — conversation + messages ──────────────────────
      // Sequential saves (no $transaction) for maximum compatibility with Neon
      // serverless connection pooling. Each operation is isolated; partial failures
      // are tolerated — the next save is still attempted.

      // Retry helper for critical DB writes — retries once after 300ms on transient failures
      async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
        try {
          return await fn()
        } catch (err) {
          console.warn(`[chatPersistence] ${label} failed on first attempt, retrying…`, err)
          await new Promise((r) => setTimeout(r, 300))
          try {
            return await fn()
          } catch (retryErr) {
            console.error(
              `[chatPersistence] ${label} failed after retry — message may be lost`,
              retryErr,
            )
            throw retryErr
          }
        }
      }

      await withRetry('conversation.upsert', () =>
        prisma.conversation.upsert({
          where: { id: conversationId },
          create: { id: conversationId, userId, title: userMessage.slice(0, 80) },
          update: {},
        }),
      )

      const userMsg = await withRetry('message.create[user]', () =>
        prisma.message.create({
          data: {
            conversationId,
            role: 'user',
            content: userMessage,
            ...(replyToMessageId ? { replyToMessageId } : {}),
          },
          select: { id: true },
        }),
      )

      const storedAssistantMessage = encodeAssistantContentWithThinking(
        assistantMessage,
        thinkingTrace,
      )

      await withRetry('message.create[assistant]', () =>
        prisma.message.create({
          data: {
            ...(assistantMessageId ? { id: assistantMessageId } : {}),
            conversationId,
            role: 'assistant',
            content: storedAssistantMessage,
            ...(domain ? { domain } : {}),
            ...(specialistName ? { specialistName } : {}),
          },
        }),
      )

      // Link uploaded files to the user message via Attachment records
      if (fileIds && fileIds.length > 0) {
        for (const fileId of fileIds) {
          try {
            const asset = await prisma.fileAsset.findUnique({
              where: { id: fileId },
              select: { id: true, filename: true, mimeType: true, size: true },
            })
            if (!asset) continue
            await prisma.attachment.create({
              data: {
                messageId: userMsg.id,
                type: asset.mimeType.startsWith('image/') ? 'image' : 'file',
                fileName: asset.filename,
                fileSize: asset.size,
                mimeType: asset.mimeType,
                url: `/api/files/${asset.id}`,
                metadata: JSON.stringify({ fileAssetId: asset.id }),
              },
            })
          } catch (attachErr) {
            console.warn(
              `[chatPersistence] attachment.create failed for fileId=${fileId}`,
              attachErr,
            )
          }
        }
      }

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
      // C1: Build summary from full conversation arc (not just the last exchange).
      // M3: Pass the actual message count so MIN_MESSAGES_FOR_SUMMARY is respected.
      const allMessages = [
        ...(recentMessages ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
        { role: 'assistant', content: stripAssistantStoredMetadata(storedAssistantMessage) },
      ]
      upsertConversationSummary({
        userId,
        conversationId,
        messages: allMessages,
        domain: domain ?? 'general',
        messageCount: allMessages.length,
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
                    select: {
                      id: true,
                      type: true,
                      title: true,
                      createdAt: true,
                      contentMarkdown: true,
                    },
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
                    createdAt: true,
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
            messagereview: {
              findMany: async (args) =>
                prisma.messageReview.findMany(args as object) as Promise<
                  Array<{ agentId: string | null; rating: number }>
                >,
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
