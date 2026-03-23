import type { AgentProfile, AgentProposal, Domain, QuickReply } from '../types'

const AGENT_EMOJI: Record<string, string> = {
  fisioterapista: '🦴',
  fisiatra: '🦴',
  cardiologo: '❤️',
  gastroenterologo: '🤢',
  dermatologo: '🧴',
  psicologo: '🧠',
  psichiatra: '💊',
  'sleep-coach': '😴',
  dietista: '🥗',
  'biologo-nutrizionista': '🧬',
  dietologo: '🥗',
  chef: '🍳',
  'persona-trainer': '💪',
  chinesologo: '🏃',
  'medico-dello-sport': '⚕️',
  endocrinologo: '🔬',
  mmg: '🩺',
  reumatologo: '🦴',
  'mental-coach': '🎯',
  'relationship-coach': '💑',
  'life-organizer': '📋',
  'consulente-legale': '⚖️',
  'financial-planner': '💰',
  'career-coach': '📈',
  'executive-coach': '🏢',
  commercialista: '📊',
  'analista-contesto': '🔍',
}

const DOMAIN_EMOJI: Record<Domain, string> = {
  health: '🏥',
  nutrition: '🥗',
  training: '💪',
  mindfulness: '🧘',
  inspiration: '💡',
  coordination: '📋',
  general: '💬',
}

export type TriageResult = {
  message: string
  quickReplies: QuickReply[]
}

/**
 * Build a multi-domain triage response when the user's message spans 2+
 * distinct domains. Instead of a blended synthesis, the user chooses which
 * topic to explore first.
 *
 * @returns A deterministic triage message + quick-reply buttons.
 */
export function buildMultiDomainTriage(
  proposals: AgentProposal[],
  team: AgentProfile[],
): TriageResult {
  // Deduplicate proposals by agentId — keep highest confidence per agent
  const bestByAgent = new Map<string, AgentProposal>()
  for (const p of proposals) {
    const existing = bestByAgent.get(p.agentId)
    if (!existing || (p.confidence ?? 0) > (existing.confidence ?? 0)) {
      bestByAgent.set(p.agentId, p)
    }
  }

  // Filter to meaningful proposals (confidence > 0) and sort descending
  const ranked = [...bestByAgent.values()]
    .filter((p) => (p.confidence ?? 0) > 0)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 6) // max 6 topics

  if (ranked.length < 2) {
    // Shouldn't happen in multi-domain context, but fallback gracefully
    return {
      message: 'Come posso aiutarti?',
      quickReplies: [],
    }
  }

  // Build quick replies — one per contributing agent
  const quickReplies: QuickReply[] = ranked.map((p) => {
    const agent = team.find((a) => a.id === p.agentId)
    const displayName = agent?.displayName ?? p.agentId
    const emoji = AGENT_EMOJI[p.agentId] ?? DOMAIN_EMOJI[p.domain] ?? '💬'

    return {
      id: crypto.randomUUID(),
      label: `${emoji} ${displayName}`,
      text: `Vorrei parlare con ${displayName}`,
      emoji,
      domain: p.domain,
    }
  })

  // Build the triage message text (a brief list of available specialists)
  const topicLines = quickReplies.map((qr) => `- **${qr.label}**`).join('\n')

  const message = [
    'Ho individuato diversi aspetti nel tuo messaggio. Ecco chi puo aiutarti:',
    '',
    topicLines,
    '',
    'Scegli con chi vuoi iniziare, oppure scrivi liberamente.',
  ].join('\n')

  return { message, quickReplies }
}
