import { AgentProfile, Domain } from '../types'

const AGENT_COMPETENCE_HINTS: Record<string, string[]> = {
  fisioterapista: ['schiena', 'lombalgia', 'sciatica', 'postura', 'riabilitazione', 'muscolo'],
  fisiatra: ['schiena', 'dolore', 'articolazione', 'riabilitazione', 'colonna', 'muscolo'],
  'medico-dello-sport': ['infortunio', 'recupero', 'muscolo', 'allenamento', 'sport'],
  cardiologo: ['cuore', 'tachicardia', 'pressione', 'palpitazioni', 'torace'],
  gastroenterologo: ['stomaco', 'intestino', 'reflusso', 'nausea', 'digestione'],
  dermatologo: ['pelle', 'rash', 'eczema', 'dermatite'],
  dietista: ['dieta', 'calorie', 'alimentazione', 'peso'],
  endocrinologo: ['tiroide', 'glicemia', 'ormoni', 'insulina', 'metabolismo'],
  psicologo: ['ansia', 'umore', 'stress', 'panico', 'depressione'],
}

const MUSCULOSKELETAL_HINTS = new Set([
  'schiena',
  'lombalgia',
  'sciatica',
  'postura',
  'muscolo',
  'muscolare',
  'colonna',
  'dolore',
  'cervicale',
])

function textToTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9àèéìòù_\-\s]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  )
}

export function selectAgentsForRequest(
  team: AgentProfile[],
  domain: Domain,
  maxAgents: number,
  allDomains: Domain[] = [],
  message = '',
): AgentProfile[] {
  const secondary = allDomains.filter((d) => d !== domain && d !== 'general')
  const lowerMessage = message.toLowerCase()
  const msgTokens = textToTokens(message)
  const hasMusculoskeletalSignal = [...msgTokens].some((t) => MUSCULOSKELETAL_HINTS.has(t))

  const scored = team.map((a) => ({
    agent: a,
    score: (() => {
      let s = 0
      if (a.domainTags.includes(domain)) s += 4
      if (a.domainTags.includes('general')) s += 1
      for (const d of secondary) if (a.domainTags.includes(d)) s += 2
      if (lowerMessage.includes(a.id.toLowerCase())) s += 2
      if (lowerMessage.includes(a.displayName.toLowerCase())) s += 2

      const competenceHints = AGENT_COMPETENCE_HINTS[a.id] ?? []
      const competenceMatches = competenceHints.filter((h) => msgTokens.has(h)).length
      if (competenceMatches > 0) s += competenceMatches * 3

      if (
        hasMusculoskeletalSignal &&
        (a.id === 'fisioterapista' || a.id === 'fisiatra' || a.id === 'medico-dello-sport')
      ) {
        s += 4
      }
      if (hasMusculoskeletalSignal && a.id === 'fisioterapista') {
        s += 1
      }
      return s
    })(),
  }))

  // F3: Filter out low-confidence specialists. With the base domain score of +4,
  // a specialist that ONLY matches on domain (no competence hints, no name mention)
  // scores exactly 4. We keep them but cap the total to avoid flooding the pipeline.
  // Agents scoring ≤ 2 (only from secondary domain or 'general') are excluded to
  // prevent out-of-scope specialists (e.g. endocrinologo on a nutrition-only query).
  return scored
    .filter((x) => x.score > 2)
    .sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id))
    .slice(0, maxAgents)
    .map((x) => x.agent)
}
