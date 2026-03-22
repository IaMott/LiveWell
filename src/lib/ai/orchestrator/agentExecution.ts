import { AgentInput, AgentProfile, AgentProposal, Domain } from '../types'
import { buildAgentUserPrompt } from './agentPrompt'
import { normalizeAgentProposal } from './proposalNormalization'
import { budgetContextPackForAgent } from '../contextBudget'

export type LlmClient = {
  complete: (args: {
    system: string
    user: string
    jsonSchema?: unknown
    stream?: boolean
    format?: 'json' | 'text'
    /** Inline images to pass as multimodal parts (synthesis call only) */
    imageData?: Array<{ mimeType: string; data: string }>
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

  // Apply token budget: each agent receives only context relevant to its domain.
  // This reduces token waste and prevents cross-domain data leakage.
  const agentDomain = agent.domainTags[0] ?? domainHint
  const budgetedInput: AgentInput = {
    ...input,
    contextPack: budgetContextPackForAgent(input.contextPack, agentDomain),
  }

  const userPrompt = buildAgentUserPrompt(budgetedInput, agent.id, peerInsights, agent.displayName)
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
