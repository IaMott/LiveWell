import path from 'node:path'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { getAuthUserId, getAuthRole, getAuthOwnerMode } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import { detectDomainFromText } from '@/lib/ai/domain/domainDetection'
import { createGeminiClient } from '@/lib/ai/gemini'
import { loadTeam } from '@/lib/ai/team/loader'
import { buildContextPack } from '@/lib/ai/context/contextPackBuilder'
import type {
  AgentInput,
  AgentProposal,
  ContextPack,
  Domain,
  Role,
  ToolCall,
  ToolResult,
} from '@/lib/ai/types'
import { ALLOWED_TOOL_NAMES, isAllowedToolName } from '@/lib/tools/toolRegistry'
import { createToolExecutor, type MutationAuditEvent } from '@/lib/tools/toolExecutor'
import { realToolHandlers, stubToolHandlers } from '@/lib/tools/handlers'
import { prisma } from '@/lib/prisma'
import { logApiErrorEvent } from '@/lib/monitoring/apiErrorEvents'

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().min(1).optional(),
  activeSpecialistId: z.string().trim().min(1).optional(),
  confirmedByUser: z.boolean().optional(),
  confirmToken: z.string().trim().min(1).optional(),
})

type ChatStreamEvent =
  | { type: 'message.delta'; id: string; delta: string }
  | {
      type: 'agent.thinking'
      specialistName: string
      title: string
      domain?: Domain
    }
  | {
      type: 'ui.state'
      domain: Domain
      moodScore: number
      sectionScores: Record<string, number>
      specialistName?: string
      activeSpecialistId?: string
      specialistDomains?: Domain[]
    }
  | {
      type: 'tool.result'
      toolCallId: string
      ok: boolean
      code?: string
      message?: string
      requiresUserConfirmation?: boolean
      confirmToken?: string
    }
  | { type: 'message.complete'; id: string; content: string }
  | { type: 'error'; code: string; message: string }

type ChatFallbackPhase =
  | 'CONVERSATION_RESOLVE'
  | 'ORCHESTRATE_SAFE_RESPONSE'
  | 'TOOL_EXECUTION'
  | 'PERSIST_CHAT_TURN'

function toSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

async function logChatFallbackEvent(input: {
  phase: ChatFallbackPhase
  requestId: string
  userId: string
  message: string
  error?: unknown
  metadata?: Record<string, unknown>
}): Promise<void> {
  const err =
    input.error instanceof Error
      ? { name: input.error.name, message: input.error.message }
      : input.error
        ? { message: String(input.error) }
        : undefined

  await logApiErrorEvent({
    endpoint: '/api/chat/send',
    errorCode: `FALLBACK_${input.phase}`,
    statusCode: 200,
    message: input.message,
    requestId: input.requestId,
    userId: input.userId,
    metadata: {
      fallbackPhase: input.phase,
      ...(err ? { cause: err } : {}),
      ...(input.metadata ?? {}),
    },
  })
}

function isDbPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test' || process.env.ENABLE_DB_IN_TEST === '1'
}

function parseToolDirective(message: string): ToolCall[] {
  const direct = message.match(/^\/tool\s+([a-zA-Z0-9._-]+)\s+([\s\S]+)$/)
  if (!direct) return []
  const name = direct[1]
  if (!(ALLOWED_TOOL_NAMES as readonly string[]).includes(name)) return []
  try {
    const args = JSON.parse(direct[2]) as unknown
    return [{ id: crypto.randomUUID(), name, args }]
  } catch {
    return []
  }
}

function buildDefaultContextPack(userId: string, role: Role): ContextPack {
  return {
    user: { id: userId, role, profile: {} },
    history: { recentMessages: [], recentArtifacts: [] },
    trackers: {},
    notifications: { unreadCount: 0 },
    files: [],
    ui: { moodScore: 50, sectionScores: { general: 50 } },
  }
}

function buildDeterministicLlm(toolCalls: ToolCall[]) {
  return {
    async complete() {
      return {
        text: JSON.stringify({
          domain: 'general',
          summary: 'Elaborazione completata dal team.',
          reasoning: 'Output orchestrato.',
          questions: [],
          recommendations: [],
          toolCalls,
          confidence: 0.8,
        }),
      }
    },
  }
}

function hasPersonalData(
  contextPack: ContextPack,
  key: 'height' | 'weight' | 'birthDate',
): boolean {
  const personal = contextPack.user.attributes?.personal
  if (personal?.[key]?.value != null) return true
  const profile = contextPack.user.profile ?? {}
  return profile[key] != null
}

function buildSafeFallbackResponse(
  message: string,
  contextPack: ContextPack,
  domain: Domain,
): string {
  const lower = message.toLowerCase()
  const greeting = /\b(ciao|salve|buongiorno|hey)\b/i.test(lower)
  if (greeting) return 'Ciao. Procediamo subito: dimmi in una frase il tuo obiettivo principale.'

  const asksAge = /\b(quanti anni|et[àa]|age)\b/i.test(lower)
  if (asksAge) {
    const birthDate =
      contextPack.user.attributes?.personal?.birthDate?.value ?? contextPack.user.profile?.birthDate
    if (!birthDate) {
      return 'Non ho la tua data di nascita registrata. Per calcolare la tua età indicami la data di nascita in formato gg/mm/aaaa.'
    }
  }

  if (domain === 'nutrition') {
    if (!hasPersonalData(contextPack, 'weight')) {
      return 'Per costruire un piano nutrizionale personalizzato mi manca solo il tuo peso attuale in kg.'
    }
    if (!hasPersonalData(contextPack, 'height')) {
      return 'Per costruire un piano nutrizionale personalizzato mi manca solo la tua altezza in cm.'
    }
    if (!hasPersonalData(contextPack, 'birthDate')) {
      return 'Per completare il piano nutrizionale mi manca solo la tua data di nascita (gg/mm/aaaa).'
    }
    return 'Ho già i dati essenziali. Dimmi il target concreto: quanti kg vuoi perdere e in quanto tempo.'
  }

  if (domain === 'training') {
    return 'Procediamo in modo pratico: indicami il sintomo o il limite principale su cui vuoi intervenire adesso.'
  }

  if (domain === 'health') {
    return 'Procediamo subito: indicami il sintomo principale, da quanto è presente e cosa lo peggiora.'
  }

  if (domain === 'mindfulness') {
    return 'Procediamo con un obiettivo concreto: preferisci lavorare su stress, sonno o ansia?'
  }

  return 'Procediamo subito: dimmi l’obiettivo principale su cui vuoi lavorare ora.'
}

function buildThinkingEvents(
  consensus: {
    debug?: { round1Proposals?: AgentProposal[]; selectedAgents?: string[] }
  },
  team: Array<{ id: string; displayName: string; domainTags: Domain[] }>,
): Array<{ specialistName: string; title: string; domain?: Domain }> {
  const normalizeTitle = (value: string | undefined): string => {
    if (!value) return 'Analisi del caso in corso'
    const lower = value.toLowerCase()
    const summaryIdx = lower.lastIndexOf('summary')
    const preferred =
      summaryIdx >= 0
        ? value
            .slice(summaryIdx)
            .replace(/^[^:]*:\s*/i, '')
            .trim()
        : value
    const stripped = preferred
      .replace(/\bdomain\s*:\s*[^\n,]+/gi, ' ')
      .replace(/\bsummary\s*:/gi, ' ')
      .replace(/[{}[\]"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!stripped) return 'Analisi del caso in corso'
    return stripped.slice(0, 72)
  }

  const round1 = consensus.debug?.round1Proposals ?? []
  if (round1.length > 0) {
    return round1.slice(0, 3).map((p) => {
      const agent = team.find((a) => a.id === p.agentId)
      return {
        specialistName: agent?.displayName ?? p.agentId,
        title: normalizeTitle(p.summary),
        domain: p.domain,
      }
    })
  }

  const selected = consensus.debug?.selectedAgents ?? []
  return selected.slice(0, 3).map((agentId) => {
    const agent = team.find((a) => a.id === agentId)
    return {
      specialistName: agent?.displayName ?? agentId,
      title: 'Valutazione specialistica in corso',
      domain: agent?.domainTags?.[0],
    }
  })
}

type RoutePersistenceDeps = {
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

function createDbPersistenceDeps(enabled: boolean): RoutePersistenceDeps {
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
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: { conversationId, role: 'user', content: userMessage },
        })

        await tx.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: assistantMessage,
            ...(domain ? { domain } : {}),
            ...(specialistName ? { specialistName } : {}),
          },
        })

        for (const event of auditEvents) {
          await tx.toolAuditLog.create({
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
        }

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
          await tx.agentWorkspace.upsert({
            where: {
              conversationId_agentId: { conversationId, agentId },
            },
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
        }

        if (toolExecutionTrace && toolExecutionTrace.length > 0) {
          await tx.agentWorkspace.upsert({
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
        }
      })
    },
    buildContextPack: async ({ userId, conversationId, role }) => {
      try {
        return await buildContextPack({
          userId,
          conversationId,
          db: {
            user: {
              findUnique: async () =>
                prisma.user.findUnique({
                  where: { id: userId },
                  select: { id: true },
                }) as Promise<{ id: string; role?: string } | null>,
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

function buildToolExecutor(
  writeAuditLog: (event: MutationAuditEvent) => Promise<void>,
  useRealHandlers: boolean,
) {
  const handlers = useRealHandlers ? realToolHandlers : stubToolHandlers
  return createToolExecutor({ handlers, writeAuditLog })
}

async function resolveConversationId(
  deps: RoutePersistenceDeps,
  input: { conversationId?: string; userId: string; message: string },
): Promise<string> {
  if (input.conversationId) {
    const existing = await deps.findConversationById(input.conversationId)
    if (existing && existing.userId === input.userId) return existing.id
    // Client-provided ID not found — create conversation with that same ID to prevent duplication
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

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  const userId = await getAuthUserId(request)
  if (!userId) {
    await logApiErrorEvent({
      endpoint: '/api/chat/send',
      errorCode: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Authentication required',
      requestId,
      userId: null,
    })
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
  }

  const rate = checkRateLimit({
    key: `chat-send:${userId}:${getClientIp(request)}`,
    max: 30,
  })
  if (!rate.ok) {
    await logApiErrorEvent({
      endpoint: '/api/chat/send',
      errorCode: 'RATE_LIMITED',
      statusCode: 429,
      message: 'Too many requests',
      requestId,
      userId,
    })
    return new Response(
      JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(rate.retryAfterSec),
        },
      },
    )
  }

  let parsedBody: z.infer<typeof requestSchema>
  try {
    const body = (await request.json()) as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      await logApiErrorEvent({
        endpoint: '/api/chat/send',
        errorCode: 'BAD_REQUEST',
        statusCode: 400,
        message: 'Invalid request body',
        requestId,
        userId,
      })
      return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
    }
    parsedBody = parsed.data
  } catch {
    await logApiErrorEvent({
      endpoint: '/api/chat/send',
      errorCode: 'BAD_REQUEST',
      statusCode: 400,
      message: 'Invalid JSON body',
      requestId,
      userId,
    })
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body')
  }

  const assistantId = crypto.randomUUID()
  const role = await getAuthRole(request)
  const ownerModeEnabled = await getAuthOwnerMode(request)
  const persistence = createDbPersistenceDeps(isDbPersistenceEnabled())
  let conversationId = parsedBody.conversationId ?? crypto.randomUUID()
  try {
    conversationId = await resolveConversationId(persistence, {
      conversationId: parsedBody.conversationId,
      userId,
      message: parsedBody.message,
    })
  } catch (error) {
    console.error('[chat/send] conversation resolve failed, using fallback', error)
    await logChatFallbackEvent({
      phase: 'CONVERSATION_RESOLVE',
      requestId,
      userId,
      message: 'conversation resolve failed, fallback conversation id used',
      error,
    })
  }

  const requestedToolCalls = parseToolDirective(parsedBody.message)
  const contextPack = await persistence.buildContextPack({
    userId,
    conversationId,
    role,
  })

  const agentInput: AgentInput = {
    requestId,
    userId,
    conversationId,
    message: parsedBody.message,
    contextPack,
    activeSpecialistId: parsedBody.activeSpecialistId,
  }

  const teamDirAbsolute = path.resolve(process.cwd(), 'TEAM')
  const team = loadTeam({ teamDirAbsolute, allowEmpty: true })
  const llm =
    requestedToolCalls.length > 0 ? buildDeterministicLlm(requestedToolCalls) : createGeminiClient()
  let consensus
  try {
    consensus = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: [...ALLOWED_TOOL_NAMES],
      },
      agentInput,
    )
  } catch (error) {
    console.error('[chat/send] orchestrate failed, using safe fallback', error)
    await logChatFallbackEvent({
      phase: 'ORCHESTRATE_SAFE_RESPONSE',
      requestId,
      userId,
      message: 'orchestrate failure fallback',
      error,
    })
    const fallbackDomain = detectDomainFromText(parsedBody.message)
    const fallbackText = buildSafeFallbackResponse(parsedBody.message, contextPack, fallbackDomain)
    consensus = {
      domain: fallbackDomain,
      finalMessageMarkdown: fallbackText,
      toolCallsToExecute: [],
      ui: {
        domainIcon: fallbackDomain,
        moodScore: contextPack.ui.moodScore,
        sectionScores: contextPack.ui.sectionScores,
      },
      safety: { escalation: 'none' as const },
      debug: { selectedAgents: [], conflicts: [] },
    }
  }

  const pendingAuditEvents: MutationAuditEvent[] = []
  const executor = buildToolExecutor(async (event) => {
    pendingAuditEvents.push(event)
  }, isDbPersistenceEnabled())

  const toolCallsToExecute =
    consensus.toolCallsToExecute.length > 0 ? consensus.toolCallsToExecute : requestedToolCalls
  const isDirectToolDirective =
    consensus.toolCallsToExecute.length === 0 && requestedToolCalls.length > 0
  const capabilityAgentId =
    consensus.activeSpecialist?.id ?? consensus.debug?.selectedAgents?.[0] ?? 'orchestratore'
  const capabilityTools = (team.find((a) => a.id === capabilityAgentId)?.toolsAllowed ?? []).filter(
    isAllowedToolName,
  )

  const toolResults: ToolResult[] = []
  for (const call of toolCallsToExecute) {
    try {
      const result = await executor.executeToolCall(call, {
        requestId: agentInput.requestId,
        conversationId: agentInput.conversationId,
        actor: {
          userId,
          role,
          ownerModeEnabled,
        },
        agent: isDirectToolDirective
          ? undefined
          : {
              id: capabilityAgentId,
              toolsAllowed: capabilityTools,
            },
        source: 'assistant',
        confirmedByUser: parsedBody.confirmedByUser ?? false,
        confirmToken: parsedBody.confirmToken,
      })
      toolResults.push(result)
    } catch (error) {
      console.error('[chat/send] tool execution failed, continuing stream', error)
      await logChatFallbackEvent({
        phase: 'TOOL_EXECUTION',
        requestId,
        userId,
        message: 'tool execution failed, tool result downgraded to INTERNAL_ERROR',
        error,
        metadata: { toolCallId: call.id, toolName: call.name },
      })
      toolResults.push({
        toolCallId: call.id,
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Tool execution failed' },
      })
    }
  }

  const toolExecutionTrace = toolCallsToExecute.map((call) => {
    const result = toolResults.find((r) => r.toolCallId === call.id)
    return {
      toolCallId: call.id,
      name: call.name,
      ok: result?.ok ?? false,
      code: result?.error?.code,
      message: result?.error?.message,
    }
  })
  const blockedToolExecutionTrace = (consensus.debug?.blockedToolCalls ?? []).map((call) => ({
    toolCallId: call.id,
    name: call.name,
    ok: false,
    code: 'RETRY_GUARD_BLOCKED',
    message: 'Blocked by non-retriable tool retry guard',
  }))
  const persistedToolExecutionTrace = [...toolExecutionTrace, ...blockedToolExecutionTrace]

  // Natural response text only — tool execution details go as separate SSE events
  const responseText = consensus.finalMessageMarkdown

  const activeDomain = consensus.activeSpecialist?.domain ?? consensus.ui.domainIcon
  const specialistName = consensus.activeSpecialist?.displayName
  const activeSpecialistId = consensus.activeSpecialist?.id
  const specialistDomains = consensus.activeSpecialist?.domains

  try {
    await persistence.persistChatTurn({
      userId,
      conversationId,
      userMessage: parsedBody.message,
      assistantMessage: responseText,
      domain: activeDomain,
      specialistName,
      auditEvents: pendingAuditEvents,
      round1Proposals: consensus.debug?.round1Proposals,
      round2Proposals: consensus.debug?.round2Proposals,
      toolExecutionTrace: persistedToolExecutionTrace,
    })
  } catch (error) {
    console.error('[chat/send] persistChatTurn failed, continuing in fallback mode', error)
    await logChatFallbackEvent({
      phase: 'PERSIST_CHAT_TURN',
      requestId,
      userId,
      message: 'persistChatTurn failed, response still streamed',
      error,
      metadata: { conversationId },
    })
  }

  const chunks = responseText.match(/.{1,32}/g) ?? [responseText]
  const thinkingEvents = buildThinkingEvents(
    {
      debug: {
        round1Proposals: consensus.debug?.round1Proposals,
        selectedAgents: consensus.debug?.selectedAgents,
      },
    },
    team,
  )
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (thinkingEvents.length > 0) {
          for (let i = 0; i < thinkingEvents.length; i += 1) {
            const ev = thinkingEvents[i]
            controller.enqueue(
              encoder.encode(
                toSse({
                  type: 'agent.thinking',
                  specialistName: ev.specialistName,
                  title: ev.title,
                  domain: ev.domain,
                }),
              ),
            )
            if (i < thinkingEvents.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 240))
            }
          }
        }

        for (let i = 0; i < chunks.length; i += 1) {
          controller.enqueue(
            encoder.encode(toSse({ type: 'message.delta', id: assistantId, delta: chunks[i] })),
          )
        }

        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'ui.state',
              domain: activeDomain,
              moodScore: consensus.ui.moodScore,
              sectionScores: consensus.ui.sectionScores ?? { general: consensus.ui.moodScore },
              specialistName,
              activeSpecialistId,
              specialistDomains,
            }),
          ),
        )

        for (const r of toolResults) {
          controller.enqueue(
            encoder.encode(
              toSse({
                type: 'tool.result',
                toolCallId: r.toolCallId,
                ok: r.ok,
                code: r.error?.code,
                message: r.error?.message,
                requiresUserConfirmation: r.requiresUserConfirmation,
                confirmToken: r.confirmToken,
              }),
            ),
          )
        }

        controller.enqueue(
          encoder.encode(
            toSse({ type: 'message.complete', id: assistantId, content: responseText }),
          ),
        )
      } catch {
        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Stream failure',
            }),
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
}
