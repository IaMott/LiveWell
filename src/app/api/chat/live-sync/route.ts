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

const bodySchema = z.object({
  conversationId: z.string().min(1),
  userMessage: z.string().trim().min(1).max(4000),
})

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
    // Live-sync is best-effort — silently succeed if orchestration fails
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
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

  return new Response(
    JSON.stringify({
      ok: true,
      stateSnapshot: canonicalStateSnapshot ?? storedStateSnapshot,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
