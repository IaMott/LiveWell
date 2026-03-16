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
}

export type ConsensusFlowResult = {
  consensus: ConsensusResult
}

export function executeConsensusFlow(input: ConsensusFlowInput): ConsensusFlowResult {
  const maxAgents = getServerEnv().ORCH_MAX_AGENTS ?? DEFAULT_MAX_AGENTS
  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents, requireGatingOnMissingInfo: true },
    team: input.team,
    proposals: input.round2Proposals,
    domainHint: input.domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: input.orchestratorToolsAllowed,
  })

  return { consensus }
}
