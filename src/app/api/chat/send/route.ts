import path from 'node:path'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { getAuthUserId, getAuthRole, getAuthOwnerMode } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { logApiErrorEvent } from '@/lib/monitoring/apiErrorEvents'
import { deriveActiveSpecialistFromCaseState } from '@/lib/ai/case/compat'
import { buildCaseThinkingEvents } from '@/lib/ai/case/events'
import { orchestrate, type ProgressEvent } from '@/lib/ai/orchestrator/orchestrator'
import { resolveRoutingCandidates } from '@/lib/ai/orchestrator/routing'
import { detectDomainFromText, detectDomainsMulti } from '@/lib/ai/domain/domainDetection'
import { createLlmWithFallback } from '@/lib/ai/llmFactory'
import { loadTeam } from '@/lib/ai/team/loader'
import type { AgentInput, AgentProfile, Domain, ToolCall, ToolResult } from '@/lib/ai/types'
import { ALLOWED_TOOL_NAMES, isAllowedToolName } from '@/lib/tools/toolRegistry'
import { createToolExecutor, type MutationAuditEvent } from '@/lib/tools/toolExecutor'
import { realToolHandlers, stubToolHandlers } from '@/lib/tools/handlers'
import { logChatFallbackEvent, buildSafeFallbackResponse } from './chatFallback'
import { moderateText, persistModerationLog } from '@/lib/ai/contentModeration'
import { toSse, buildThinkingEvents, mergeThinkingEvents } from './chatStream'
import {
  isDbPersistenceEnabled,
  createDbPersistenceDeps,
  resolveConversationId,
} from './chatPersistence'
import { checkAndCreateCheckpointNotifications } from '@/lib/ai/program/checkpoints'

export { buildDefaultContextPack } from './chatPersistence'

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().min(1).optional(),
  confirmedByUser: z.boolean().optional(),
  confirmToken: z.string().trim().min(1).optional(),
})

// ── Fase 6: Cartella notification labels ──────────────────────────────────
const CARTELLA_KEY_LABELS: Record<string, string> = {
  weight: 'Peso',
  height: 'Altezza',
  gender: 'Sesso',
  birthDate: 'Data di nascita',
  age: 'Età',
  goal: 'Obiettivo',
  allergy: 'Allergie',
  diagnosis: 'Diagnosi',
  medications: 'Farmaci',
  symptoms: 'Sintomi',
  sport: 'Sport',
  injury: 'Infortuni',
  stress_level: 'Stress',
  sleep_hours: 'Ore sonno',
  blood_pressure: 'Pressione',
  training_frequency_per_week: 'Allenamenti/sett.',
  food_triggers: 'Trigger alimentari',
  complaint: 'Motivo consulto',
  meal_pattern: 'Schema pasti',
}

function formatToolValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Sì' : 'No'
  if (typeof v === 'string') return v.length > 50 ? v.slice(0, 47) + '...' : v
  if (typeof v === 'number') return String(v)
  return String(v).slice(0, 50)
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

function buildToolExecutor(
  writeAuditLog: (event: MutationAuditEvent) => Promise<void>,
  useRealHandlers: boolean,
) {
  const handlers = useRealHandlers ? realToolHandlers : stubToolHandlers
  return createToolExecutor({ handlers, writeAuditLog })
}

/**
 * Returns the actual agents that will handle the request, using the same
 * resolveRoutingCandidates logic as orchestrate(). This ensures the initial
 * thinking animation matches who actually responds.
 */
function getImmediateThinkingAgents(
  team: AgentProfile[],
  message: string,
  caseState: Parameters<typeof deriveActiveSpecialistFromCaseState>[0],
): AgentProfile[] {
  const detectedDomain = detectDomainFromText(message)
  const allDomains = detectDomainsMulti(message).map((d) => d.domain)

  // Determine active specialist from case state (mirrors orchestrate logic)
  const activeSpecialist = deriveActiveSpecialistFromCaseState(caseState, team)

  const { selectedAgents } = resolveRoutingCandidates({
    team,
    message,
    detectedDomain,
    allDomains,
    currentSpeakerId: activeSpecialist?.id,
  })

  // Return up to 2 agents for the immediate animation
  return selectedAgents
    .filter(
      (a) => a.id !== 'orchestratore' && a.id !== 'intervistatore' && a.id !== 'analista-contesto',
    )
    .slice(0, 2)
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

  // Layer 3 — Proactive checkpoint notifications (fire-and-forget, non-blocking)
  if (isDbPersistenceEnabled()) {
    checkAndCreateCheckpointNotifications(userId).catch(() => {})
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

  // ── Content moderation ──────────────────────────────────────────────────
  const modResult = moderateText(parsedBody.message)
  if (modResult.action !== 'none') {
    persistModerationLog({
      userId,
      conversationId,
      requestId,
      result: modResult,
      messageExcerpt: parsedBody.message.slice(0, 100),
    })
  }
  if (modResult.action === 'block' && modResult.emergencyMessage) {
    const emergencyId = crypto.randomUUID()
    const enc = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(
          enc.encode(
            toSse({ type: 'message.delta', id: emergencyId, delta: modResult.emergencyMessage! }),
          ),
        )
        ctrl.enqueue(
          enc.encode(
            toSse({
              type: 'message.complete',
              id: emergencyId,
              content: modResult.emergencyMessage!,
            }),
          ),
        )
        ctrl.close()
      },
    })
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }
  // ────────────────────────────────────────────────────────────────────────

  const requestedToolCalls = parseToolDirective(parsedBody.message)
  const contextPack = await persistence.buildContextPack({
    userId,
    conversationId,
    role,
  })
  const storedCaseState = await persistence.getCaseState({ conversationId })
  const teamDirAbsolute = path.resolve(process.cwd(), 'TEAM')
  const team = loadTeam({ teamDirAbsolute, allowEmpty: true })
  const caseActiveSpecialist = deriveActiveSpecialistFromCaseState(storedCaseState, team)

  const agentInput: AgentInput = {
    requestId,
    userId,
    conversationId,
    message: parsedBody.message,
    contextPack,
    caseState: storedCaseState,
  }

  const llm =
    requestedToolCalls.length > 0
      ? buildDeterministicLlm(requestedToolCalls)
      : createLlmWithFallback()

  // Use the same routing logic as orchestrate() for accurate immediate agents
  const immediateAgents = getImmediateThinkingAgents(team, parsedBody.message, storedCaseState)
  const msgPreviewImmediate = parsedBody.message.slice(0, 48).trim()

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // ── Step 1: Immediate thinking events (before orchestrate) ─────────
        // Uses resolveRoutingCandidates (same as orchestrate) for accurate agent names
        for (let i = 0; i < immediateAgents.length; i++) {
          const agent = immediateAgents[i]
          controller.enqueue(
            encoder.encode(
              toSse({
                type: 'agent.thinking',
                specialistName: agent.displayName,
                title: `"${msgPreviewImmediate}${parsedBody.message.length > 48 ? '…' : ''}"`,
                domain: agent.domainTags[0] as Domain | undefined,
                thought: `Analizza: "${msgPreviewImmediate}${parsedBody.message.length > 48 ? '…' : ''}"`,
              }),
            ),
          )
          // Short delay between immediate events
          await new Promise((r) => setTimeout(r, 280))
        }

        // ── Step 2: Orchestrate (main AI work) ────────────────────────────
        // onProgress emits real-time thinking events during orchestration
        const onProgress = (event: ProgressEvent) => {
          controller.enqueue(
            encoder.encode(
              toSse({
                type: 'agent.thinking',
                specialistName: event.displayName,
                title: event.thought,
                domain: team.find((a) => a.id === event.agentId)?.domainTags[0] as
                  | Domain
                  | undefined,
                thought: event.thought,
              }),
            ),
          )
        }

        let consensus
        try {
          consensus = await orchestrate(
            {
              llm,
              team,
              orchestratorToolsAllowed: [...ALLOWED_TOOL_NAMES],
              onProgress,
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
          const fallbackText = buildSafeFallbackResponse(
            parsedBody.message,
            contextPack,
            fallbackDomain,
          )
          consensus = {
            domain: fallbackDomain,
            finalMessageMarkdown: fallbackText,
            toolCallsToExecute: [],
            caseState: storedCaseState ?? undefined,
            protocolEvents: [],
            activeSpecialist: caseActiveSpecialist,
            ui: {
              domainIcon: fallbackDomain,
              moodScore: contextPack.ui.moodScore,
              sectionScores: contextPack.ui.sectionScores,
            },
            safety: { escalation: 'none' as const },
            debug: { selectedAgents: [], conflicts: [] },
          }
        }

        // ── Step 3: Tool execution ─────────────────────────────────────────
        const pendingAuditEvents: MutationAuditEvent[] = []
        const executor = buildToolExecutor(async (event) => {
          pendingAuditEvents.push(event)
        }, isDbPersistenceEnabled())

        const toolCallsToExecute =
          consensus.toolCallsToExecute.length > 0
            ? consensus.toolCallsToExecute
            : requestedToolCalls
        const isDirectToolDirective = requestedToolCalls.length > 0
        const capabilityAgentId =
          consensus.activeSpecialist?.id ?? consensus.debug?.selectedAgents?.[0] ?? 'orchestratore'
        const capabilityTools = (
          team.find((a) => a.id === capabilityAgentId)?.toolsAllowed ?? []
        ).filter(isAllowedToolName)

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

        // ── Step 4: Persist ────────────────────────────────────────────────
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
            // C1: Pass full history so the long-term memory summary covers the whole arc.
            recentMessages: contextPack.history.recentMessages,
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
        if (consensus.caseState) {
          try {
            await persistence.persistCaseState({
              userId,
              conversationId,
              caseState: consensus.caseState,
            })
          } catch (error) {
            console.error('[chat/send] persistCaseState failed, continuing in fallback mode', error)
            await logChatFallbackEvent({
              phase: 'PERSIST_CHAT_TURN',
              requestId,
              userId,
              message: 'persistCaseState failed, response still streamed',
              error,
              metadata: { conversationId, layer: 'case_state' },
            })
          }
        }

        // ── Step 5: Real thinking events (proposal-based, fast) ───────────
        const cpUserName = (contextPack.user?.profile as Record<string, unknown> | undefined)
          ?.name as string | undefined
        const protocolThinkingEvents = buildCaseThinkingEvents(consensus.protocolEvents ?? [], team)
        const proposalThinkingEvents = buildThinkingEvents(
          {
            debug: {
              round1Proposals: consensus.debug?.round1Proposals,
              selectedAgents: consensus.debug?.selectedAgents,
            },
          },
          team,
          parsedBody.message,
          cpUserName ?? null,
        )
        const thinkingEvents =
          protocolThinkingEvents.length > 0
            ? protocolThinkingEvents
            : mergeThinkingEvents(protocolThinkingEvents, proposalThinkingEvents)

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
                  thought: ev.thought,
                }),
              ),
            )
            // Brief pause between real steps, longer before first response chunk
            await new Promise((resolve) =>
              setTimeout(resolve, i < thinkingEvents.length - 1 ? 180 : 500),
            )
          }
        }

        // ── Step 6: Stream response ────────────────────────────────────────
        // C2: Use [\s\S] so newlines inside markdown are not dropped.
        const chunks = responseText.match(/[\s\S]{1,32}/g) ?? [responseText]
        for (let i = 0; i < chunks.length; i += 1) {
          controller.enqueue(
            encoder.encode(toSse({ type: 'message.delta', id: assistantId, delta: chunks[i] })),
          )
        }

        // ── Step 7: ui.state, tool results, complete ───────────────────────
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
              // S1: Include conversationId so the client can sync newly-created conversations.
              conversationId,
            }),
          ),
        )

        for (const r of toolResults) {
          // Fase 6: Build a human-readable notification for setAttribute saves
          let cartellaMessage: string | undefined
          const matchingCall = toolCallsToExecute.find((c) => c.id === r.toolCallId)
          if (matchingCall?.name === 'user.setAttribute' && r.ok) {
            const args = matchingCall.args as { domain?: string; key?: string; value?: unknown }
            const label = CARTELLA_KEY_LABELS[args.key ?? ''] ?? args.key ?? 'dato'
            cartellaMessage = `${label}: ${formatToolValue(args.value)} → salvato in cartella`
          }

          controller.enqueue(
            encoder.encode(
              toSse({
                type: 'tool.result',
                toolCallId: r.toolCallId,
                ok: r.ok,
                code: r.error?.code,
                message: cartellaMessage ?? r.error?.message,
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
