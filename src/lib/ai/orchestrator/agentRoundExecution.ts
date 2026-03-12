import { AgentInput, AgentProfile, AgentProposal, Domain } from '../types'
import { executeAgent, LlmClient } from './agentExecution'

export type ExecuteAgentRoundsParams = {
  llm: LlmClient
  selectedAgents: AgentProfile[]
  input: AgentInput
  domainHint: Domain
}

export type AgentRoundExecutionResult = {
  round1Proposals: AgentProposal[]
  round2Proposals: AgentProposal[]
}

function buildPeerInsights(agentId: string, round1Proposals: AgentProposal[]): string | undefined {
  const peerInsights = round1Proposals
    .filter((proposal) => proposal.agentId !== agentId)
    .slice(0, 3)
    .map((proposal) => `- ${proposal.agentId}: ${proposal.summary}`)
    .join('\n')

  return peerInsights || undefined
}

export async function executeAgentRounds(
  params: ExecuteAgentRoundsParams,
): Promise<AgentRoundExecutionResult> {
  const { llm, selectedAgents, input, domainHint } = params
  const executionInput = { ...input, domainHint }

  const round1Proposals = await Promise.all(
    selectedAgents.map((agent) =>
      executeAgent({
        llm,
        agent,
        input: executionInput,
        domainHint,
      }),
    ),
  )

  const round2Proposals = await Promise.all(
    selectedAgents.map((agent) =>
      executeAgent({
        llm,
        agent,
        input: executionInput,
        domainHint,
        peerInsights: buildPeerInsights(agent.id, round1Proposals),
      }),
    ),
  )

  return { round1Proposals, round2Proposals }
}
