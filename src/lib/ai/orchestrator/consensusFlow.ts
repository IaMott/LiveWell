import { runConsensus } from '../consensus/consensusEngine'
import type { AgentProfile, AgentProposal, ConsensusResult, ContextPack, Domain } from '../types'
import { getServerEnv } from '@/lib/validators/env'

const DEFAULT_MAX_AGENTS = 4

export type ConsensusFlowInput = {
  team: AgentProfile[]
  round2Proposals: AgentProposal[]
  domainHint: Domain
  contextPack: ContextPack
  orchestratorToolsAllowed: string[]
  /** Tutte le proposte per fase: [fase1[], fase2[], ...] — per integrare agenti ritirati */
  allPhaseProposals?: AgentProposal[][]
}

export type ConsensusFlowResult = {
  consensus: ConsensusResult
}

export function executeConsensusFlow(input: ConsensusFlowInput): ConsensusFlowResult {
  const maxAgents = getServerEnv().ORCH_MAX_AGENTS ?? DEFAULT_MAX_AGENTS

  // Se disponibili, costruisci un mergedProposals che include anche gli agenti ritirati.
  // Per ogni agente nell'ultima fase teniamo la proposta finale; aggiungiamo poi le proposte
  // degli agenti NON presenti nell'ultima fase (ritirati) se hanno confidence >= 0.3.
  let proposalsForConsensus = input.round2Proposals
  if (input.allPhaseProposals && input.allPhaseProposals.length > 0) {
    const lastPhase = input.allPhaseProposals[input.allPhaseProposals.length - 1] ?? []
    const lastPhaseAgentIds = new Set(lastPhase.map((p) => p.agentId))

    // Contributi di agenti ritirati (non presenti nell'ultima fase) con confidence >= 0.3
    const retiredContributions = input.allPhaseProposals
      .flat()
      .filter((p) => !lastPhaseAgentIds.has(p.agentId) && (p.confidence ?? 0) >= 0.3)

    // Per i ritirati, tieni solo il best per agentId
    const retiredBest = new Map<string, AgentProposal>()
    for (const p of retiredContributions) {
      const ex = retiredBest.get(p.agentId)
      if (!ex || (p.confidence ?? 0) > (ex.confidence ?? 0)) retiredBest.set(p.agentId, p)
    }

    proposalsForConsensus = [...lastPhase, ...retiredBest.values()]
  }

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents, requireGatingOnMissingInfo: true },
    team: input.team,
    proposals: proposalsForConsensus,
    domainHint: input.domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: input.orchestratorToolsAllowed,
  })

  return { consensus }
}
