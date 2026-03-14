import { AgentProposal, Domain } from '../types'

type NormalizeAgentProposalParams = {
  text: string
  agentId: string
  domainHint: Domain
}

export function normalizeAgentProposal(params: NormalizeAgentProposalParams): AgentProposal {
  const { text, agentId, domainHint } = params

  try {
    const obj = JSON.parse(text)
    const toolCalls = Array.isArray(obj.toolCalls) ? obj.toolCalls : []

    return {
      agentId,
      domain: (obj.domain as Domain) ?? domainHint,
      summary: String(obj.summary ?? '').slice(0, 600),
      reasoning: String(obj.reasoning ?? '').slice(0, 4000),
      questions: Array.isArray(obj.questions) ? obj.questions.map(String).slice(0, 8) : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
      toolCalls,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.6,
      citations: Array.isArray(obj.citations) ? obj.citations : [],
      flags: obj.flags ?? {},
    }
  } catch {
    return {
      agentId,
      domain: domainHint,
      summary: text.slice(0, 600),
      reasoning: text.slice(0, 4000),
      questions: [],
      recommendations: [],
      toolCalls: [],
      confidence: 0.4,
    }
  }
}
