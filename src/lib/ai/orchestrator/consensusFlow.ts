import { runConsensus } from '../consensus/consensusEngine'
import type { AgentProfile, AgentProposal, ConsensusResult, ContextPack, Domain } from '../types'

export type ConsensusFlowInput = {
  team: AgentProfile[]
  round2Proposals: AgentProposal[]
  domainHint: Domain
  contextPack: ContextPack
  orchestratorToolsAllowed: string[]
}

export type ConsensusFlowResult = {
  consensus: ConsensusResult
}

export function executeConsensusFlow(input: ConsensusFlowInput): ConsensusFlowResult {
  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: input.team,
    proposals: input.round2Proposals,
    domainHint: input.domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: input.orchestratorToolsAllowed,
  })

  return { consensus }
}
