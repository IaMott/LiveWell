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
 * Extract a short preview (first sentence, max ~80 chars) from a proposal's
 * reasoning or summary. Falls back to an empty string.
 */
function extractPreview(proposal: AgentProposal): string {
  const raw = proposal.reasoning || proposal.summary || ''
  if (!raw) return ''

  // Take the first sentence (stop at . ? ! or newline)
  const firstSentence = raw.split(/[.?!\n]/)[0]?.trim() ?? ''

  if (firstSentence.length <= 80) return firstSentence
  // Truncate at last space before 80 chars
  const truncated = firstSentence.slice(0, 80)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + '…'
}

/**
 * Build a multi-domain triage response when the user's message spans 2+
 * distinct domains. Instead of a blended synthesis, the user chooses which
 * topic to explore first.
 *
 * Each specialist gets a brief preview line from their proposal reasoning,
 * plus a tappable quick-reply button.
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
    return {
      message: 'Come posso aiutarti?',
      quickReplies: [],
    }
  }

  // Build quick replies + topic lines with preview
  const quickReplies: QuickReply[] = []
  const topicLines: string[] = []

  for (const p of ranked) {
    const agent = team.find((a) => a.id === p.agentId)
    const displayName = agent?.displayName ?? p.agentId
    const emoji = AGENT_EMOJI[p.agentId] ?? DOMAIN_EMOJI[p.domain] ?? '💬'
    const preview = extractPreview(p)

    quickReplies.push({
      id: crypto.randomUUID(),
      label: `${emoji} ${displayName}`,
      text: `Vorrei parlare con ${displayName}`,
      emoji,
      domain: p.domain,
    })

    // Topic line: "- **🦴 Fisioterapista** — Il dolore al collo potrebbe…"
    const previewSuffix = preview ? ` — ${preview}` : ''
    topicLines.push(`- **${emoji} ${displayName}**${previewSuffix}`)
  }

  const message = [
    'Ho individuato diversi aspetti nel tuo messaggio:',
    '',
    ...topicLines,
    '',
    "Con chi vuoi iniziare? Tocca un'opzione o scrivi liberamente.",
  ].join('\n')

  return { message, quickReplies }
}
