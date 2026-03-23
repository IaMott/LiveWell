import { AgentProfile, Domain } from '../types'

const AGENT_COMPETENCE_HINTS: Record<string, string[]> = {
  fisioterapista: ['schiena', 'lombalgia', 'sciatica', 'postura', 'riabilitazione', 'muscolo'],
  fisiatra: ['schiena', 'dolore', 'articolazione', 'riabilitazione', 'colonna', 'muscolo'],
  'medico-dello-sport': ['infortunio', 'recupero', 'muscolo', 'allenamento', 'sport'],
  cardiologo: ['cuore', 'tachicardia', 'pressione', 'palpitazioni', 'torace'],
  gastroenterologo: [
    'stomaco',
    'intestino',
    'reflusso',
    'nausea',
    'digestione',
    'bruciore',
    'acidità',
    'gastrite',
    'colite',
    'gonfiore addominale',
  ],
  dermatologo: ['pelle', 'rash', 'eczema', 'dermatite'],
  dietista: [
    'dieta',
    'pasto',
    'ricetta',
    'menu',
    'schema alimentare',
    'porzioni',
    'fabbisogno calorico',
    'calorie',
  ],
  endocrinologo: ['tiroide', 'glicemia', 'ormoni', 'insulina', 'metabolismo'],
  psicologo: [
    'ansia',
    'umore',
    'stress',
    'panico',
    'depressione',
    'triste',
    'preoccupato',
    'angoscia',
  ],
  'biologo-nutrizionista': [
    'microbiota',
    'integratori',
    'vitamine',
    'minerali',
    'nutrienti',
    'supplementi',
    'antiossidanti',
    'carenze',
    'flora',
  ],
  dietologo: [
    'diabete',
    'colesterolo',
    'metabolismo',
    'celiachia',
    'sovrappeso',
    'dislipidemia',
    'dieta',
  ],
  psichiatra: [
    'psicofarmaci',
    'antidepressivi',
    'ansiolitici',
    'bipolare',
    'schizofrenia',
    'psicosi',
    'farmaci',
  ],
  reumatologo: [
    'artrite',
    'reumatismi',
    'lupus',
    'fibromialgia',
    'articolazioni',
    'autoimmune',
    'artralgia',
    'gonfiore',
  ],
  'sleep-coach': [
    'sonno',
    'insonnia',
    'dormire',
    'risvegli',
    'apnea',
    'melatonina',
    'circadiano',
    'sonnolenza',
  ],
  'persona-trainer': [
    'allenamento',
    'palestra',
    'esercizio',
    'workout',
    'forza',
    'resistenza',
    'stretching',
  ],
  mmg: ['febbre', 'malessere', 'visita', 'ricetta', 'esami', 'farmaco', 'sintomi'],
  chef: ['ricetta', 'cucina', 'piatto', 'ingredienti', 'preparazione', 'cottura'],
  chinesologo: ['movimento', 'postura', 'ginnastica', 'esercizio', 'motoria'],
  'mental-coach': ['motivazione', 'obiettivi', 'focus', 'resilienza', 'mentalità', 'performance'],
  'relationship-coach': ['relazione', 'coppia', 'comunicazione', 'partner', 'conflitto'],
  'life-organizer': ['organizzazione', 'priorità', 'tempo', 'produttività', 'pianificazione'],
}

// FIX-2: Removed 'dolore' — too generic (any pain mention triggered musculoskeletal bias).
// Kept only anatomy/condition-specific terms.
const MUSCULOSKELETAL_HINTS = new Set([
  'schiena',
  'lombalgia',
  'sciatica',
  'postura',
  'muscolo',
  'muscolare',
  'colonna',
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

      // FIX-2: Reduced from +4/+5 to +2 — musculoskeletal signal should boost
      // relevant agents moderately, not dominate scoring. Removed individual
      // fisioterapista bonus to avoid systematic preference.
      if (
        hasMusculoskeletalSignal &&
        (a.id === 'fisioterapista' || a.id === 'fisiatra' || a.id === 'medico-dello-sport')
      ) {
        s += 2
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
