import { AgentProposal, Domain } from '../types'

type NormalizeAgentProposalParams = {
  text: string
  agentId: string
  domainHint: Domain
}

// P11 — Domain alias map: agents are prompted in Italian and may emit
// Italian domain names (nutrizione, allenamento, salute-biologica, salute-mentale, idee).
// The canonical Domain type uses English keys. Without this normalization the proposal
// reaches the consensus engine with an invalid Domain string, which then survives
// `enforceDomainIsolation` because the "violation" branch only fires when the agent's
// primary domain is set — silently leaking a wrong domain into UI, gating questions,
// and tool-call routing.
const DOMAIN_ALIAS_MAP: Record<string, Domain> = {
  nutrizione: 'nutrition',
  nutrition: 'nutrition',
  allenamento: 'training',
  training: 'training',
  fitness: 'training',
  salute: 'health',
  'salute-biologica': 'health',
  health: 'health',
  'salute-mentale': 'mindfulness',
  mindfulness: 'mindfulness',
  'mental-health': 'mindfulness',
  idee: 'inspiration',
  inspiration: 'inspiration',
  ideas: 'inspiration',
  coordination: 'coordination',
  general: 'general',
}

function normalizeDomain(raw: unknown, fallback: Domain): Domain {
  if (typeof raw !== 'string') return fallback
  const key = raw.toLowerCase().trim()
  return DOMAIN_ALIAS_MAP[key] ?? fallback
}

export function normalizeAgentProposal(params: NormalizeAgentProposalParams): AgentProposal {
  const { text, agentId, domainHint } = params

  try {
    const obj = JSON.parse(text) as Record<string, unknown>

    // Detect Gemini API error responses (e.g. 503 returned as JSON text)
    const err = obj?.error as Record<string, unknown> | undefined
    if (err?.code && err?.message) {
      return {
        agentId,
        domain: domainHint,
        summary: `[Unavailable] Agent ${agentId} could not respond: ${String(err.message)}`,
        reasoning: JSON.stringify(err),
        questions: [],
        recommendations: [],
        toolCalls: [],
        confidence: 0,
      }
    }

    const toolCalls = Array.isArray(obj.toolCalls) ? obj.toolCalls : []

    return {
      agentId,
      domain: normalizeDomain(obj.domain, domainHint),
      summary: String(obj.summary ?? '').slice(0, 600),
      reasoning: String(obj.reasoning ?? '').slice(0, 4000),
      questions: Array.isArray(obj.questions) ? obj.questions.map(String).slice(0, 8) : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
      toolCalls,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.6,
      citations: Array.isArray(obj.citations) ? obj.citations : [],
      suggestedConsultants: Array.isArray(obj.suggestedConsultants)
        ? obj.suggestedConsultants.map(String).slice(0, 3)
        : [],
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
