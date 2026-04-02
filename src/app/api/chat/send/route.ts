import path from 'node:path'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { getAuthUserId, getAuthRole, getAuthOwnerMode } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { logApiErrorEvent } from '@/lib/monitoring/apiErrorEvents'
import {
  deriveActiveSpecialistFromCaseState,
  toCanonicalCaseStateSnapshot,
} from '@/lib/ai/case/compat'
import { buildCaseThinkingEvents } from '@/lib/ai/case/events'
import { orchestrate, type ProgressEvent } from '@/lib/ai/orchestrator/orchestrator'
import { resolveRoutingCandidates } from '@/lib/ai/orchestrator/routing'

import { detectDomainFromText, detectDomainsMulti } from '@/lib/ai/domain/domainDetection'
import { createLlmWithFallback } from '@/lib/ai/llmFactory'
import { loadTeam } from '@/lib/ai/team/loader'
import { resolveAgentRuntimeDomain } from '@/lib/ai/team/domainMapping'
import type { AgentInput, AgentProfile, AgentProposal, ToolCall, ToolResult } from '@/lib/ai/types'
import { ALLOWED_TOOL_NAMES, isAllowedToolName } from '@/lib/tools/toolRegistry'
import { createToolExecutor, type MutationAuditEvent } from '@/lib/tools/toolExecutor'
import { realToolHandlers, stubToolHandlers } from '@/lib/tools/handlers'
import { resolveToolExecutionAgent } from '@/lib/tools/toolExecutionRouting'
import { logChatFallbackEvent, buildSafeFallbackResponse } from './chatFallback'
import { moderateText, persistModerationLog } from '@/lib/ai/contentModeration'
import { toSse, buildThinkingEvents } from './chatStream'
import {
  isDbPersistenceEnabled,
  createDbPersistenceDeps,
  resolveConversationId,
} from './chatPersistence'
import { checkAndCreateCheckpointNotifications } from '@/lib/ai/program/checkpoints'
import type { PersistedThinkingStep } from '@/lib/chat/thinkingPersistence'
import { sanitizeAssistantVisibleContent } from '@/lib/chat/userVisibleContent'

export { buildDefaultContextPack } from './chatPersistence'

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().min(1).optional(),
  confirmedByUser: z.boolean().optional(),
  confirmToken: z.string().trim().min(1).optional(),
  /** P5: FileAsset IDs uploaded alongside this message */
  fileIds: z.array(z.string().min(1)).max(5).optional(),
  /** Multi-reply: ID of the message this turn is replying to */
  replyToMessageId: z.string().min(1).optional(),
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

function formatAgentIdLabel(agentId?: string | null): string | undefined {
  if (!agentId) return undefined
  const normalized = agentId.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return undefined
  return normalized.replace(/\b\w/g, (ch) => ch.toUpperCase())
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
  input: {
    caseState: Parameters<typeof deriveActiveSpecialistFromCaseState>[0]
    caseStateSnapshot?: AgentInput['caseStateSnapshot']
  },
): AgentProfile[] {
  const detectedDomain = detectDomainFromText(message)
  const allDomains = detectDomainsMulti(message).map((d) => d.domain)

  const leadPanel =
    input.caseStateSnapshot?.domainPanels.find(
      (panel) => panel.domain === input.caseStateSnapshot?.leadDomain,
    ) ?? input.caseStateSnapshot?.domainPanels[0]
  const activeSpecialistId =
    leadPanel?.selectedAgentId ?? deriveActiveSpecialistFromCaseState(input.caseState, team)?.id

  const { selectedAgents } = resolveRoutingCandidates({
    team,
    message,
    detectedDomain,
    allDomains,
    currentSpeakerId: activeSpecialistId,
  })

  // Return up to 2 agents for the immediate animation
  return selectedAgents
    .filter(
      (a) => a.id !== 'orchestratore' && a.id !== 'intervistatore' && a.id !== 'analista-contesto',
    )
    .slice(0, 2)
}

function normalizeThinkingText(value?: string): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\r\n/g, '\n').trim()
  return normalized.length > 0 ? normalized : undefined
}

function dedupeThinkingSteps(steps: PersistedThinkingStep[]): PersistedThinkingStep[] {
  const out: PersistedThinkingStep[] = []
  const seen = new Set<string>()

  for (const step of steps) {
    const specialistName = step.specialistName.trim()
    const title = step.title.trim()
    const thought = normalizeThinkingText(step.thought)
    const domain = step.domain
    if (!specialistName || !title) continue

    const key = `${specialistName}:${title}:${thought ?? ''}:${domain ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ specialistName, title, thought, domain })
  }

  return out
}

function buildProposalThinkingTrace(
  proposals: AgentProposal[] | undefined,
  team: AgentProfile[],
  phaseLabel?: string,
): PersistedThinkingStep[] {
  const steps: PersistedThinkingStep[] = []

  // Agenti secondari: esclusi dal trace solo se ci sono altri agenti con contributi validi.
  // In questo modo il trace non è mai vuoto (es. in mock mode dove solo orchestratore risponde).
  const SECONDARY_TRACE_AGENTS = new Set(['intervistatore', 'analista-contesto'])

  const meaningfulProposals = (proposals ?? []).filter(
    (p) => !SECONDARY_TRACE_AGENTS.has(p.agentId) && (p.confidence ?? 0) > 0,
  )
  const hasPrimaryAgents = meaningfulProposals.length > 0

  for (const proposal of proposals ?? []) {
    if ((proposal.confidence ?? 0) === 0) continue
    // Escludi agenti secondari solo se ci sono agenti primari nel trace
    if (SECONDARY_TRACE_AGENTS.has(proposal.agentId) && hasPrimaryAgents) continue

    const agent = team.find((a) => a.id === proposal.agentId)
    if (!agent) continue

    // Try primary sources: summary + reasoning
    let title = normalizeThinkingText(proposal.summary)
    let thought = normalizeThinkingText(proposal.reasoning)

    if (title?.toLowerCase().includes('[unavailable]')) title = undefined
    if (thought?.toLowerCase().includes('[unavailable]')) thought = undefined

    // Fallback 1: first recommendation title + rationale
    if (!title && proposal.recommendations && proposal.recommendations.length > 0) {
      const rec = proposal.recommendations[0]
      title = normalizeThinkingText(rec.title)
      thought =
        normalizeThinkingText(rec.rationale) ?? normalizeThinkingText(rec.steps?.[0]) ?? title
    }

    // Fallback 2: first pending question
    if (!title && proposal.questions && proposal.questions.length > 0) {
      title = `Da valutare: ${proposal.questions[0]}`
      thought = proposal.questions.join(' | ')
    }

    if (!title) continue

    // Il titolo del passo nel reasoning accordion è la fase (breve) +
    // il summary dello specialista (max 80 chars per leggibilità).
    // Il "thought" è il ragionamento esteso (fino a 500 chars).
    const shortTitle = title.length > 80 ? `${title.slice(0, 77)}…` : title
    const labeledTitle = phaseLabel ? `${phaseLabel} · ${shortTitle}` : shortTitle
    const fullThought = thought && thought.length > 0 ? thought : title

    steps.push({
      specialistName: agent.displayName,
      title: labeledTitle,
      thought: fullThought,
      domain: proposal.domain,
    })
  }

  return dedupeThinkingSteps(steps)
}

/**
 * Costruisce il trace completo di tutte le fasi del pipeline multi-agente.
 * Ogni fase è etichettata (Fase 1 · Briefing, Fase 2 · Peer Review, ecc.)
 * in modo che il reasoning accordion mostri l'intero ragionamento inter-agente.
 */
function buildAllPhasesThinkingTrace(
  allPhaseProposals: AgentProposal[][],
  team: AgentProfile[],
): PersistedThinkingStep[] {
  const steps: PersistedThinkingStep[] = []
  for (let i = 0; i < allPhaseProposals.length; i++) {
    const phaseLabel = i === 0 ? `Fase 1 · Briefing` : `Fase ${i + 1} · Peer Review`
    steps.push(...buildProposalThinkingTrace(allPhaseProposals[i], team, phaseLabel))
  }
  return dedupeThinkingSteps(steps)
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

  // P5: Bind uploaded FileAssets to the (now-resolved) conversationId.
  // When files are uploaded before the first message, they have conversationId = null.
  // We update them here so contextPackBuilder can find them in the query below.
  if (parsedBody.fileIds && parsedBody.fileIds.length > 0 && isDbPersistenceEnabled()) {
    try {
      const { prisma } = await import('@/lib/prisma')
      await prisma.fileAsset.updateMany({
        where: {
          id: { in: parsedBody.fileIds },
          userId,
          conversationId: null,
        },
        data: { conversationId },
      })
    } catch {
      // best-effort — files may not appear in this turn's context but will in later turns
    }
  }

  const requestedToolCalls = parseToolDirective(parsedBody.message)
  const contextPack = await persistence.buildContextPack({
    userId,
    conversationId,
    role,
  })
  const storedCaseRuntimeState = await persistence.getCaseRuntimeState({ conversationId })
  const storedCaseState = storedCaseRuntimeState
    ? null
    : await persistence.getCaseState({ conversationId })
  const teamDirAbsolute = path.resolve(process.cwd(), 'TEAM')
  const team = loadTeam({ teamDirAbsolute, allowEmpty: true })
  const leadPanel =
    storedCaseRuntimeState?.domainPanels.find(
      (panel) => panel.domain === storedCaseRuntimeState?.leadDomain,
    ) ?? storedCaseRuntimeState?.domainPanels[0]
  const caseActiveSpecialist =
    leadPanel?.selectedAgentId != null
      ? (() => {
          const teamAgent = team.find((agent) => agent.id === leadPanel.selectedAgentId)
          return teamAgent
            ? {
                id: teamAgent.id,
                displayName: teamAgent.displayName,
                domain: leadPanel.domain,
                domains: teamAgent.domainTags,
                runtimeCapabilities: teamAgent.runtimeCapabilities,
              }
            : undefined
        })()
      : deriveActiveSpecialistFromCaseState(storedCaseState, team)

  const agentInput: AgentInput = {
    requestId,
    userId,
    conversationId,
    message: parsedBody.message,
    contextPack,
    caseState: storedCaseState,
    caseStateSnapshot: storedCaseRuntimeState,
    replyToMessageId: parsedBody.replyToMessageId ?? null,
  }

  const llm =
    requestedToolCalls.length > 0
      ? buildDeterministicLlm(requestedToolCalls)
      : createLlmWithFallback()

  // Use the same routing logic as orchestrate() for accurate immediate agents
  const immediateAgents = getImmediateThinkingAgents(team, parsedBody.message, {
    caseState: storedCaseState,
    caseStateSnapshot: storedCaseRuntimeState,
  })
  const streamDomainHint =
    storedCaseRuntimeState?.leadDomain ?? detectDomainFromText(parsedBody.message)

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const streamedThinkingTrace: PersistedThinkingStep[] = []
        const thinkingTraceKeys = new Set<string>()
        const normalizeThinkingEvent = (event: PersistedThinkingStep) => {
          const specialistName = event.specialistName.trim()
          const title = event.title.trim()
          const thought = event.thought?.trim() || undefined
          const domain = event.domain
          if (!specialistName || !title) return null

          return { specialistName, title, thought, domain }
        }

        const recordThinkingEvent = (event: PersistedThinkingStep) => {
          const normalized = normalizeThinkingEvent(event)
          if (!normalized) return null

          const dedupeKey = `${normalized.specialistName}:${normalized.title}:${normalized.thought ?? ''}:${normalized.domain ?? ''}`
          if (thinkingTraceKeys.has(dedupeKey)) return null

          thinkingTraceKeys.add(dedupeKey)
          streamedThinkingTrace.push(normalized)
          return normalized
        }

        const emitThinkingEvent = (
          event: PersistedThinkingStep,
          options?: { persist?: boolean },
        ) => {
          const normalized =
            options?.persist === false ? normalizeThinkingEvent(event) : recordThinkingEvent(event)
          if (!normalized) return
          const { specialistName, title, thought, domain } = normalized
          controller.enqueue(
            encoder.encode(
              toSse({
                type: 'agent.thinking',
                specialistName,
                title,
                domain,
                thought,
              }),
            ),
          )
        }

        // ── Step 1: Immediate thinking events (before orchestrate) ─────────
        // Visual-only placeholders — not persisted so they don't pollute the export.
        for (let i = 0; i < immediateAgents.length; i++) {
          const agent = immediateAgents[i]
          emitThinkingEvent(
            {
              specialistName: agent.displayName,
              title: 'Analisi in corso',
              domain: resolveAgentRuntimeDomain(agent, {
                preferredDomain: agentInput.caseStateSnapshot?.leadDomain ?? streamDomainHint,
                fallbackDomain: streamDomainHint,
              }),
              thought: 'Valutazione del caso in corso',
            },
            { persist: false },
          )
          // Short delay between immediate events
          await new Promise((r) => setTimeout(r, 280))
        }

        // ── Step 2: Orchestrate (main AI work) ────────────────────────────
        // Generic structural labels are emitted live for the UI but NOT persisted.
        // Only real agent reasoning (non-generic thought text) is saved to the trace.
        const GENERIC_ORCHESTRATOR_THOUGHTS = new Set([
          'Valutazione del caso in corso',
          'Confronto tra specialisti',
        ])
        const isGenericOrchThought = (thought: string) =>
          GENERIC_ORCHESTRATOR_THOUGHTS.has(thought) ||
          thought.startsWith('Consenso raggiunto') ||
          thought.startsWith('Analisi autonoma')
        const onProgress = (event: ProgressEvent) => {
          const isGeneric = isGenericOrchThought(event.thought)
          emitThinkingEvent(
            {
              specialistName: event.displayName,
              title: event.thought,
              domain: resolveAgentRuntimeDomain(
                team.find((a) => a.id === event.agentId),
                {
                  preferredDomain: agentInput.caseStateSnapshot?.leadDomain ?? streamDomainHint,
                  fallbackDomain: streamDomainHint,
                },
              ),
              thought: event.thought,
            },
            { persist: !isGeneric },
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
            stateSnapshot: storedCaseRuntimeState ?? undefined,
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
        const toolExecutionSnapshot =
          consensus.stateSnapshot ??
          (consensus.caseState
            ? (toCanonicalCaseStateSnapshot(consensus.caseState) ?? undefined)
            : undefined) ??
          storedCaseRuntimeState ??
          undefined

        const toolResults: ToolResult[] = []
        for (const call of toolCallsToExecute) {
          const selectedAgent = isDirectToolDirective
            ? undefined
            : resolveToolExecutionAgent({
                call,
                team,
                stateSnapshot: toolExecutionSnapshot,
                activeSpecialistId: consensus.activeSpecialist?.id,
                selectedAgentIds: consensus.debug?.selectedAgents,
              })
          try {
            const result = await executor.executeToolCall(call, {
              requestId: agentInput.requestId,
              conversationId: agentInput.conversationId,
              actor: {
                userId,
                role,
                ownerModeEnabled,
              },
              agent: selectedAgent
                ? {
                    id: selectedAgent.id,
                    toolsAllowed: selectedAgent.toolsAllowed.filter(isAllowedToolName),
                  }
                : undefined,
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

        // ── A3 FIX: Early audit flush ─────────────────────────────────────
        // Write audit events to DB immediately after tool execution completes,
        // BEFORE streaming starts. This ensures they survive a client disconnect
        // or a subsequent persistChatTurn failure.
        // pendingAuditEvents is then cleared so persistChatTurn doesn't double-write.
        if (isDbPersistenceEnabled() && pendingAuditEvents.length > 0) {
          const { prisma: auditPrisma } = await import('@/lib/prisma')
          await Promise.allSettled(
            pendingAuditEvents.map((event) =>
              auditPrisma.toolAuditLog.create({
                data: {
                  userId: event.actorUserId,
                  conversationId: event.conversationId ?? null,
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  inputSummary: event.inputSummary,
                  inputHash: event.inputHash,
                  status: event.status,
                  requestId: event.requestId,
                  errorCode: event.errorCode ?? null,
                },
              }),
            ),
          )
          // Clear so persistChatTurn receives an empty array and won't duplicate
          pendingAuditEvents.length = 0
        }

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
        // Protocol events (case state transitions) take priority: when present they
        // describe the real handoff flow and the proposal summaries would be redundant.
        // Fall back to proposal events only when no protocol events exist.
        const thinkingEvents =
          protocolThinkingEvents.length > 0 ? protocolThinkingEvents : proposalThinkingEvents
        // Usa allPhaseProposals se disponibile (trace completo per fase),
        // altrimenti fallback a round1 + round2 (backward compat)
        const allPhaseProposals = consensus.debug?.allPhaseProposals
        const proposalTrace =
          allPhaseProposals && allPhaseProposals.length > 0
            ? buildAllPhasesThinkingTrace(allPhaseProposals, team)
            : dedupeThinkingSteps([
                ...buildProposalThinkingTrace(consensus.debug?.round1Proposals, team),
                ...buildProposalThinkingTrace(consensus.debug?.round2Proposals, team),
              ])
        const protocolTrace = dedupeThinkingSteps(
          protocolThinkingEvents.map((event) => ({
            specialistName: event.specialistName,
            title: event.title,
            domain: event.domain,
            thought: event.thought,
          })),
        )
        const persistedThinkingTrace =
          proposalTrace.length > 0
            ? dedupeThinkingSteps([...proposalTrace, ...protocolTrace])
            : dedupeThinkingSteps([...protocolTrace, ...streamedThinkingTrace])

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

        const rawResponseText = consensus.finalMessageMarkdown
        const responseText =
          sanitizeAssistantVisibleContent(rawResponseText) ||
          'Ho registrato le informazioni principali. Possiamo continuare.'
        const nextCaseState = consensus.caseState ?? null
        const canonicalStateSnapshot =
          consensus.stateSnapshot ??
          (nextCaseState ? (toCanonicalCaseStateSnapshot(nextCaseState) ?? undefined) : undefined)
        const stateSnapshot = canonicalStateSnapshot ?? storedCaseRuntimeState ?? undefined
        const leadPanel =
          stateSnapshot?.domainPanels.find((panel) => panel.domain === stateSnapshot.leadDomain) ??
          stateSnapshot?.domainPanels[0]
        const activeDomain =
          stateSnapshot?.leadDomain ?? consensus.activeSpecialist?.domain ?? consensus.ui.domainIcon
        const activeSpecialistId = leadPanel?.selectedAgentId ?? consensus.activeSpecialist?.id
        const specialistName =
          consensus.activeSpecialist?.displayName ?? formatAgentIdLabel(leadPanel?.selectedAgentId)
        const specialistDomains = leadPanel?.domain
          ? [leadPanel.domain]
          : consensus.activeSpecialist?.domains

        try {
          await persistence.persistChatTurn({
            userId,
            conversationId,
            userMessage: parsedBody.message,
            assistantMessage: responseText,
            assistantMessageId: assistantId,
            thinkingTrace: persistedThinkingTrace,
            domain: activeDomain,
            specialistName,
            auditEvents: pendingAuditEvents,
            round1Proposals: consensus.debug?.round1Proposals,
            round2Proposals: consensus.debug?.round2Proposals,
            allPhaseProposals: consensus.debug?.allPhaseProposals,
            toolExecutionTrace: persistedToolExecutionTrace,
            // C1: Pass full history so the long-term memory summary covers the whole arc.
            recentMessages: contextPack.history.recentMessages,
            // P5: Link uploaded files to the user message
            fileIds: parsedBody.fileIds,
            // Multi-reply: link the user message to the referenced assistant message
            replyToMessageId: parsedBody.replyToMessageId,
            // Phase 2.5: specialist display names for ClinicalEvent annotations
            agentDisplayNames: Object.fromEntries(team.map((a) => [a.id, a.displayName])),
            agentDomainMap: Object.fromEntries(
              team.map((a) => [a.id, (a.domainTags as string[])[0] ?? 'general']),
            ),
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
        if (canonicalStateSnapshot) {
          try {
            await persistence.persistCaseRuntimeState({
              userId,
              conversationId,
              caseState: canonicalStateSnapshot,
            })
          } catch (error) {
            console.error('[chat/send] persistCaseState failed, continuing in fallback mode', error)
            await logChatFallbackEvent({
              phase: 'PERSIST_CHAT_TURN',
              requestId,
              userId,
              message: 'persistCaseState failed, response still streamed',
              error,
              metadata: { conversationId, layer: 'case_state_runtime' },
            })
          }
        } else if (nextCaseState) {
          try {
            await persistence.persistCaseState({
              userId,
              conversationId,
              caseState: nextCaseState,
            })
          } catch (error) {
            console.error('[chat/send] persistCaseState failed, continuing in fallback mode', error)
            await logChatFallbackEvent({
              phase: 'PERSIST_CHAT_TURN',
              requestId,
              userId,
              message: 'persistCaseState failed, response still streamed',
              error,
              metadata: { conversationId, layer: 'case_state_legacy_fallback' },
            })
          }
        }

        // ── Step 5: Real thinking events (proposal-based, fast) ───────────
        if (thinkingEvents.length > 0) {
          for (let i = 0; i < thinkingEvents.length; i += 1) {
            const ev = thinkingEvents[i]
            emitThinkingEvent(
              {
                specialistName: ev.specialistName,
                title: ev.title,
                domain: ev.domain,
                thought: ev.thought,
              },
              { persist: false },
            )
            // Brief pause between real steps, longer before first response chunk
            await new Promise((resolve) =>
              setTimeout(resolve, i < thinkingEvents.length - 1 ? 180 : 500),
            )
          }
        }

        // ── Step 6: Stream response ────────────────────────────────────────
        // Multi-agent mode: emit individual agent responses BEFORE the unified response.
        // Each agent gets its own message bubble in the frontend.
        const agentResponses = consensus.agentResponses ?? []
        if (agentResponses.length >= 2) {
          for (const agentResp of agentResponses) {
            const agentMsgId = crypto.randomUUID()
            controller.enqueue(
              encoder.encode(
                toSse({
                  type: 'agent.response',
                  id: agentMsgId,
                  agentId: agentResp.agentId,
                  agentName: agentResp.agentName,
                  domain: agentResp.domain,
                  content: agentResp.content,
                }),
              ),
            )
          }
        }

        // C2: Use [\s\S] so newlines inside markdown are not dropped.
        // In multi-agent mode, skip streaming the unified response — individual
        // agent bubbles have already been sent. The unified text is still persisted
        // in the DB as a backup/summary.
        if (agentResponses.length < 2) {
          const chunks = responseText.match(/[\s\S]{1,32}/g) ?? [responseText]
          for (let i = 0; i < chunks.length; i += 1) {
            controller.enqueue(
              encoder.encode(toSse({ type: 'message.delta', id: assistantId, delta: chunks[i] })),
            )
          }
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
              stateSnapshot,
              // S1: Include conversationId so the client can sync newly-created conversations.
              conversationId,
              // Multi-agent expansion/retirement info for frontend display
              expandedAgentIds: consensus.debug?.expandedAgentIds ?? [],
              retiredAgentIds: consensus.debug?.retiredAgentIds ?? [],
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
            toSse({
              type: 'message.complete',
              id: assistantId,
              content: responseText,
              // Invia il trace finale al client: sostituisce gli step live generici
              // con il ragionamento reale degli specialisti (summary + reasoning da Gemini).
              thinkingSteps: persistedThinkingTrace.length > 0 ? persistedThinkingTrace : undefined,
            }),
          ),
        )

        // ── Step 8: Quick-reply suggestions ────────────────────────────────
        // Priority order:
        // 1. Contextual quick replies — detected from the last question in the response
        // 2. Multi-domain triage quick replies — from consensus engine
        // Static single-domain fallbacks removed: they were too generic ("Approfondisci", "passo")
        const { buildContextualQuickReplies } =
          await import('@/lib/ai/orchestrator/contextualQuickReplies')
        const contextualQrs = buildContextualQuickReplies(responseText)
        const multiQrs = consensus.quickReplies ?? []
        const suggestionsToSend = contextualQrs.length > 0 ? contextualQrs : multiQrs

        if (suggestionsToSend.length > 0) {
          controller.enqueue(
            encoder.encode(
              toSse({
                type: 'message.suggestions',
                suggestions: suggestionsToSend.map((qr) => ({
                  id: qr.id,
                  label: qr.label,
                  text: qr.text,
                  emoji: qr.emoji,
                  domain: qr.domain,
                })),
              }),
            ),
          )
        }
      } catch (error) {
        console.error('[chat/send] stream failure', error)
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
