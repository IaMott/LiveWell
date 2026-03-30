import { AgentInput, AgentProfile, AgentProposal, Domain } from '../types'
import { executeAgent, LlmClient } from './agentExecution'

export const AGENT_TIMEOUT_MS = 8_000

/** Max total agents across all rounds (initial + pyramidal expansions) */
const MAX_TOTAL_AGENTS = 6

export type ExecuteAgentRoundsParams = {
  llm: LlmClient
  selectedAgents: AgentProfile[]
  input: AgentInput
  domainHint: Domain
  timeoutMs?: number
  /** Full team roster — needed to resolve pyramidal consultant suggestions */
  fullTeam?: AgentProfile[]
}

export type AgentRoundExecutionResult = {
  round1Proposals: AgentProposal[]
  round2Proposals: AgentProposal[]
  /** Agent IDs added via pyramidal consultation (Round 1 suggestions) */
  expandedAgentIds?: string[]
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve within
 * `ms` milliseconds, it rejects with a descriptive error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, agentId: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Agent ${agentId} timed out after ${ms}ms`)), ms),
  )
  return Promise.race([promise, timeout])
}

/**
 * Creates a fallback AgentProposal when an agent fails or times out.
 */
function buildFallbackProposal(agentId: string, domainHint: Domain, reason: string): AgentProposal {
  return {
    agentId,
    domain: domainHint,
    summary: `[Unavailable] Agent ${agentId} could not respond: ${reason}`,
    reasoning: '',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0,
  }
}

function buildPeerInsights(agentId: string, round1Proposals: AgentProposal[]): string | undefined {
  const peerInsights = round1Proposals
    .filter((proposal) => proposal.agentId !== agentId && proposal.confidence !== 0)
    .slice(0, 3)
    .map((proposal) => `- ${proposal.agentId}: ${proposal.summary}`)
    .join('\n')

  return peerInsights || undefined
}

export async function executeAgentRounds(
  params: ExecuteAgentRoundsParams,
): Promise<AgentRoundExecutionResult> {
  const { llm, selectedAgents, input, domainHint } = params
  const timeoutMs = params.timeoutMs ?? AGENT_TIMEOUT_MS
  const executionInput = { ...input, domainHint }

  const round1Results = await Promise.allSettled(
    selectedAgents.map((agent) =>
      withTimeout(
        executeAgent({ llm, agent, input: executionInput, domainHint }),
        timeoutMs,
        agent.id,
      ),
    ),
  )

  const round1Proposals: AgentProposal[] = round1Results.map((result, i) => {
    const agent = selectedAgents[i]!
    if (result.status === 'fulfilled') return result.value
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.warn(`[agentRoundExecution] Round 1 agent ${agent.id} failed: ${reason}`)
    return buildFallbackProposal(agent.id, domainHint, reason)
  })

  // ── Pyramidal expansion: collect consultant suggestions from Round 1 ───
  const fullTeam = params.fullTeam ?? []
  const existingIds = new Set(selectedAgents.map((a) => a.id))
  const suggestedIds = new Set<string>()

  for (const proposal of round1Proposals) {
    if (!proposal.suggestedConsultants?.length) continue
    if ((proposal.confidence ?? 0) < 0.3) continue // ignore low-confidence suggestions
    for (const consultId of proposal.suggestedConsultants) {
      if (!existingIds.has(consultId) && !suggestedIds.has(consultId)) {
        suggestedIds.add(consultId)
      }
    }
  }

  // Resolve suggested agents from the full team roster, respecting global cap
  const slotsAvailable = MAX_TOTAL_AGENTS - selectedAgents.length
  const expandedAgents: AgentProfile[] = []
  if (slotsAvailable > 0 && suggestedIds.size > 0 && fullTeam.length > 0) {
    for (const id of suggestedIds) {
      if (expandedAgents.length >= slotsAvailable) break
      const agent = fullTeam.find((a) => a.id === id)
      if (agent) {
        expandedAgents.push(agent)
        console.info(
          `[agentRoundExecution] Pyramidal expansion: adding ${id} (suggested by Round 1)`,
        )
      }
    }
  }

  // ── Round 2: original agents (with peer insights) + expanded agents (fresh) ───
  const allRound2Agents = [...selectedAgents, ...expandedAgents]

  const round2Results = await Promise.allSettled(
    allRound2Agents.map((agent, index) => {
      // Original agents: skip if confidence=0 in Round 1
      if (index < selectedAgents.length) {
        const round1Proposal = round1Proposals[index]
        if (round1Proposal?.confidence === 0) {
          return Promise.resolve(round1Proposal)
        }
        return withTimeout(
          executeAgent({
            llm,
            agent,
            input: executionInput,
            domainHint,
            peerInsights: buildPeerInsights(agent.id, round1Proposals),
          }),
          timeoutMs,
          agent.id,
        )
      }

      // Expanded agents: fresh execution with full peer insights from Round 1
      return withTimeout(
        executeAgent({
          llm,
          agent,
          input: executionInput,
          domainHint,
          peerInsights: buildPeerInsights(agent.id, round1Proposals),
        }),
        timeoutMs,
        agent.id,
      )
    }),
  )

  const round2Proposals: AgentProposal[] = round2Results.map((result, i) => {
    const agent = allRound2Agents[i]!
    if (result.status === 'fulfilled') return result.value
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.warn(`[agentRoundExecution] Round 2 agent ${agent.id} failed: ${reason}`)
    return buildFallbackProposal(agent.id, domainHint, reason)
  })

  return {
    round1Proposals,
    round2Proposals,
    expandedAgentIds: expandedAgents.map((a) => a.id),
  }
}
