import path from 'node:path'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { getAuthUserId, getAuthRole, getAuthOwnerMode } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import { createGeminiClient } from '@/lib/ai/gemini'
import { loadTeam } from '@/lib/ai/team/loader'
import { buildContextPack } from '@/lib/ai/context/contextPackBuilder'
import type { AgentInput, ContextPack, Domain, Role, ToolCall, ToolResult } from '@/lib/ai/types'
import { ALLOWED_TOOL_NAMES } from '@/lib/tools/toolRegistry'
import { createToolExecutor, type MutationAuditEvent } from '@/lib/tools/toolExecutor'
import { realToolHandlers, stubToolHandlers } from '@/lib/tools/handlers'
import { prisma } from '@/lib/prisma'

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().min(1).optional(),
  confirmedByUser: z.boolean().optional(),
  confirmToken: z.string().trim().min(1).optional(),
})

type ChatStreamEvent =
  | { type: 'message.delta'; id: string; delta: string }
  | {
      type: 'ui.state'
      domain: Domain
      moodScore: number
      sectionScores: Record<string, number>
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

function toSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

function isDbPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test' || process.env.ENABLE_DB_IN_TEST === '1'
}

// Role and owner mode are resolved via getAuthRole / getAuthOwnerMode from auth.ts.
// In test environment: header-based (x-user-role, x-owner-mode-enabled).
// In production: session-based (NextAuth JWT).

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

// buildDeterministicLlm: used only when the user sends an explicit /tool directive.
// Bypasses LLM entirely and injects the tool calls directly into the AgentProposal.
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

type RoutePersistenceDeps = {
  findConversationById: (id: string) => Promise<{ id: string; userId: string } | null>
  createConversation: (input: { userId: string; title: string }) => Promise<{ id: string }>
  persistChatTurn: (input: {
    conversationId: string
    userMessage: string
    assistantMessage: string
    auditEvents: MutationAuditEvent[]
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
      createConversation: async () => ({ id: crypto.randomUUID() }),
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

  // Fallback for models not yet in schema (e.g. medicalInfo)
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
    createConversation: async ({ userId, title }) =>
      prisma.conversation.create({
        data: { userId, title },
        select: { id: true },
      }),
    persistChatTurn: async ({ conversationId, userMessage, assistantMessage, auditEvents }) => {
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: { conversationId, role: 'user', content: userMessage },
        })

        await tx.message.create({
          data: { conversationId, role: 'assistant', content: assistantMessage },
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
                prisma.recommendationArtifact.findMany({
                  ...(args as object),
                  select: { type: true, title: true, createdAt: true, contentMarkdown: true },
                }).then((rows) =>
                  rows.map((r) => ({ ...r, content: r.contentMarkdown })),
                ),
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
  // In NODE_ENV=test, always use stub handlers so tests don't need
  // a full DB mock for every model the real handler might touch.
  const handlers =
    useRealHandlers && process.env.NODE_ENV !== 'test' ? realToolHandlers : stubToolHandlers
  return createToolExecutor({ handlers, writeAuditLog })
}

async function resolveConversationId(
  deps: RoutePersistenceDeps,
  input: { conversationId?: string; userId: string; message: string },
): Promise<string> {
  if (input.conversationId) {
    const existing = await deps.findConversationById(input.conversationId)
    if (existing && existing.userId === input.userId) return existing.id
  }
  const created = await deps.createConversation({
    userId: input.userId,
    title: input.message.slice(0, 80),
  })
  return created.id
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
  }

  const rate = checkRateLimit({
    key: `chat-send:${userId}:${getClientIp(request)}`,
    max: 30,
  })
  if (!rate.ok) {
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
    if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
    parsedBody = parsed.data
  } catch {
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
  }

  const requestedToolCalls = parseToolDirective(parsedBody.message)
  const contextPack = await persistence.buildContextPack({
    userId,
    conversationId,
    role,
  })

  const agentInput: AgentInput = {
    requestId: crypto.randomUUID(),
    userId,
    conversationId,
    message: parsedBody.message,
    contextPack,
  }

  const teamDirAbsolute = path.resolve(process.cwd(), 'TEAM')
  const team = loadTeam({ teamDirAbsolute, allowEmpty: true })
  // Use deterministic mock only for explicit /tool directives; otherwise use real Gemini.
  const llm =
    requestedToolCalls.length > 0
      ? buildDeterministicLlm(requestedToolCalls)
      : createGeminiClient()
  const consensus = await orchestrate(
    {
      llm,
      team,
      orchestratorToolsAllowed: [...ALLOWED_TOOL_NAMES],
    },
    agentInput,
  )

  const pendingAuditEvents: MutationAuditEvent[] = []
  const executor = buildToolExecutor(
    async (event) => { pendingAuditEvents.push(event) },
    isDbPersistenceEnabled(),
  )

  const toolCallsToExecute =
    consensus.toolCallsToExecute.length > 0 ? consensus.toolCallsToExecute : requestedToolCalls

  const toolResults: ToolResult[] = []
  for (const call of toolCallsToExecute) {
    const result = await executor.executeToolCall(call, {
      requestId: agentInput.requestId,
      conversationId: agentInput.conversationId,
      actor: {
        userId,
        role,
        ownerModeEnabled,
      },
      source: 'assistant',
      confirmedByUser: parsedBody.confirmedByUser ?? false,
      confirmToken: parsedBody.confirmToken,
    })
    toolResults.push(result)
  }

  const toolLines = toolResults.map((r) =>
    r.ok ? `Tool ${r.toolCallId}: ok` : `Tool ${r.toolCallId}: ${r.error?.code ?? 'ERROR'}`,
  )
  const responseText =
    toolLines.length > 0
      ? `${consensus.finalMessageMarkdown}\n\n${toolLines.join('\n')}`
      : consensus.finalMessageMarkdown

  try {
    await persistence.persistChatTurn({
      conversationId,
      userMessage: parsedBody.message,
      assistantMessage: responseText,
      auditEvents: pendingAuditEvents,
    })
  } catch (error) {
    // Non-blocking fallback: response streaming must continue even when DB persistence fails.
    console.error('[chat/send] persistChatTurn failed, continuing in fallback mode', error)
  }

  const chunks = responseText.match(/.{1,32}/g) ?? [responseText]
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(toSse({ type: 'message.delta', id: assistantId, delta: chunk })),
          )
        }

        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'ui.state',
              domain: consensus.ui.domainIcon,
              moodScore: consensus.ui.moodScore,
              sectionScores: consensus.ui.sectionScores ?? { general: consensus.ui.moodScore },
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

