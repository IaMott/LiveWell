import path from 'node:path'
import { z } from 'zod'
import { getAuthUserId, getAuthRole, getAuthOwnerMode } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { toCanonicalCaseStateSnapshot } from '@/lib/ai/case/compat'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import { createLlmWithFallback } from '@/lib/ai/llmFactory'
import { loadTeam } from '@/lib/ai/team/loader'
import type { AgentInput } from '@/lib/ai/types'
import { ALLOWED_TOOL_NAMES, isAllowedToolName } from '@/lib/tools/toolRegistry'
import { createToolExecutor } from '@/lib/tools/toolExecutor'
import { realToolHandlers } from '@/lib/tools/handlers'
import { resolveToolExecutionAgent } from '@/lib/tools/toolExecutionRouting'
import {
  isDbPersistenceEnabled,
  createDbPersistenceDeps,
} from '@/app/api/chat/send/chatPersistence'
import type { AgentProfile, AgentProposal, Domain } from '@/lib/ai/types'
import type { PersistedThinkingStep } from '@/lib/chat/thinkingPersistence'

const bodySchema = z.object({
  conversationId: z.string().min(1),
  userMessage: z.string().trim().min(1).max(4000),
})

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
): PersistedThinkingStep[] {
  const steps: PersistedThinkingStep[] = []

  for (const proposal of proposals ?? []) {
    if ((proposal.confidence ?? 0) === 0) continue

    const agent = team.find((a) => a.id === proposal.agentId)
    if (!agent) continue

    let title = normalizeThinkingText(proposal.summary)
    let thought = normalizeThinkingText(proposal.reasoning)

    if (title?.toLowerCase().includes('[unavailable]')) title = undefined
    if (thought?.toLowerCase().includes('[unavailable]')) thought = undefined

    if (!title && proposal.recommendations && proposal.recommendations.length > 0) {
      const rec = proposal.recommendations[0]
      title = normalizeThinkingText(rec.title)
      thought =
        normalizeThinkingText(rec.rationale) ?? normalizeThinkingText(rec.steps?.[0]) ?? title
    }

    if (!title && proposal.questions && proposal.questions.length > 0) {
      title = `Da valutare: ${proposal.questions[0]}`
      thought = proposal.questions.join(' | ')
    }

    if (!title) continue

    steps.push({
      specialistName: agent.displayName,
      title,
      thought: thought ?? title,
      domain: proposal.domain as Domain,
    })
  }

  return dedupeThinkingSteps(steps)
}

/**
 * POST /api/chat/live-sync
 * Background orchestration for Live sessions.
 * Runs the full AI pipeline (including setAttribute tool calls and case state
 * updates) for a completed live turn — WITHOUT saving a new assistant message
 * to the conversation (the live audio response already happened via Gemini Live).
 *
 * Fire-and-forget from the client side: the response is not awaited for UI.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
  }

  const { conversationId, userMessage } = body
  const role = await getAuthRole(request)
  const ownerModeEnabled = await getAuthOwnerMode(request)
  const persistence = createDbPersistenceDeps(isDbPersistenceEnabled())

  // Verify conversation ownership
  const existing = await persistence.findConversationById(conversationId)
  if (!existing || existing.userId !== userId) {
    return errorResponse(404, 'NOT_FOUND', 'Conversation not found')
  }

  const requestId = crypto.randomUUID()
  const contextPack = await persistence.buildContextPack({ userId, conversationId, role })
  const storedCaseRuntimeState = await persistence.getCaseRuntimeState({ conversationId })
  const storedCaseState = storedCaseRuntimeState
    ? null
    : await persistence.getCaseState({ conversationId })
  const storedStateSnapshot = storedCaseRuntimeState ?? undefined
  const teamDirAbsolute = path.resolve(process.cwd(), 'TEAM')
  const team = loadTeam({ teamDirAbsolute, allowEmpty: true })

  const agentInput: AgentInput = {
    requestId,
    userId,
    conversationId,
    message: userMessage,
    contextPack,
    caseState: storedCaseState,
    caseStateSnapshot: storedStateSnapshot,
  }

  const llm = createLlmWithFallback()

  let consensus
  try {
    consensus = await orchestrate(
      { llm, team, orchestratorToolsAllowed: [...ALLOWED_TOOL_NAMES] },
      agentInput,
    )
  } catch {
    // D1: Live-sync is best-effort but returns a detectable failure signal (503)
    // so the client can show a quality-degraded indicator instead of silently
    // assuming the turn was processed correctly.
    return new Response(
      JSON.stringify({ ok: false, skipped: true, reason: 'orchestration_failed' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Execute tool calls (setAttribute etc.) — the core reason for live-sync
  if (consensus.toolCallsToExecute.length > 0) {
    const executor = createToolExecutor({
      handlers: realToolHandlers,
      writeAuditLog: async () => undefined,
    })

    const liveStateSnapshot =
      consensus.stateSnapshot ??
      (consensus.caseState
        ? (toCanonicalCaseStateSnapshot(consensus.caseState) ?? undefined)
        : undefined) ??
      storedStateSnapshot
    for (const call of consensus.toolCallsToExecute) {
      const selectedAgent = resolveToolExecutionAgent({
        call,
        team,
        stateSnapshot: liveStateSnapshot,
        activeSpecialistId: consensus.activeSpecialist?.id,
        selectedAgentIds: consensus.debug?.selectedAgents,
      })

      try {
        await executor.executeToolCall(call, {
          requestId,
          conversationId,
          actor: { userId, role, ownerModeEnabled },
          agent: selectedAgent
            ? {
                id: selectedAgent.id,
                toolsAllowed: selectedAgent.toolsAllowed.filter(isAllowedToolName),
              }
            : undefined,
          source: 'assistant',
          confirmedByUser: false,
          confirmToken: undefined,
        })
      } catch {
        // Best-effort: continue even if a single tool call fails
      }
    }
  }

  // Persist updated case state
  const nextCaseState = consensus.caseState ?? null
  const canonicalStateSnapshot =
    consensus.stateSnapshot ??
    (nextCaseState ? (toCanonicalCaseStateSnapshot(nextCaseState) ?? undefined) : undefined)
  if (canonicalStateSnapshot) {
    try {
      await persistence.persistCaseRuntimeState({
        userId,
        conversationId,
        caseState: canonicalStateSnapshot,
      })
    } catch {
      // best-effort
    }
  } else if (nextCaseState) {
    try {
      await persistence.persistCaseState({ userId, conversationId, caseState: nextCaseState })
    } catch {
      // best-effort
    }
  }

  const thinkingSteps = buildProposalThinkingTrace(
    [...(consensus.debug?.round1Proposals ?? []), ...(consensus.debug?.round2Proposals ?? [])],
    team,
  )

  return new Response(
    JSON.stringify({
      ok: true,
      stateSnapshot: canonicalStateSnapshot ?? storedStateSnapshot,
      thinkingSteps,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
