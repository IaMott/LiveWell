import { AgentInput, AgentProfile, AgentProposal, Domain } from '../types'
import { buildAgentUserPrompt } from './agentPrompt'
import { normalizeAgentProposal } from './proposalNormalization'

export type LlmClient = {
  complete: (args: {
    system: string
    user: string
    jsonSchema?: unknown
    stream?: boolean
    format?: 'json' | 'text'
  }) => Promise<{ text: string }>
}

export type ExecuteAgentParams = {
  llm: LlmClient
  agent: AgentProfile
  input: AgentInput
  domainHint: Domain
  peerInsights?: string
}

export async function executeAgent(params: ExecuteAgentParams): Promise<AgentProposal> {
  const { llm, agent, input, domainHint, peerInsights } = params

  const userPrompt = buildAgentUserPrompt(input, agent.id, peerInsights)
  const res = await llm.complete({
    system: agent.systemPrompt,
    user: userPrompt,
  })

  return normalizeAgentProposal({
    text: res.text,
    agentId: agent.id,
    domainHint,
  })
}
