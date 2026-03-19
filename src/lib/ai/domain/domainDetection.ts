import type { Domain } from '../types'

const KEYWORDS: Record<Domain, string[]> = {
  nutrition: [
    'cibo',
    'dieta',
    'alimentare',
    'alimenti',
    'mangiare',
    'mangio',
    'mangiare meglio',
    'piano alimentare',
    'menu',
    'dimagrire',
    'perdere peso',
    'peso',
    'allergie alimentari',
    'intolleranze alimentari',
    'gastrite',
    'digestiv',
    'macro',
    'kcal',
    'calorie',
    'ricetta',
    'ricette',
    'spesa',
    'lista spesa',
    'barcode',
    'meal',
    'pasto',
    'colazione',
    'pranzo',
    'cena',
    'spuntino',
  ],
  training: [
    'allenamento',
    'palestra',
    'allenarmi',
    'ricominciare ad allenarmi',
    'allenarmi meglio',
    'workout',
    'scheda',
    'programma',
    'esercizio',
    'esercizi',
    'serie',
    'ripetizioni',
    'reps',
    'sets',
    'carico',
    'peso sollevato',
    'recupero',
    'protocollo di recupero',
    'timer',
  ],
  health: [
    'peso',
    'pressione',
    'dolore',
    'infortunio',
    'sintomo',
    'medico',
    'farmaco',
    'allergia',
    'condizione',
    'salute',
    'misure',
    'bf',
    'body fat',
    'gonfiore',
    'digestiv',
    'reflusso',
    'nausea',
    'vomito',
    'giramenti',
    'vertigini',
    'sfoghi',
    'sfogo',
    'cutanei',
    'eczema',
    'pressione alta',
  ],
  mindfulness: [
    'ansia',
    'stress',
    'umore',
    'sonno',
    'dormo male',
    'dormo malissimo',
    'burnout',
    'concentrarmi',
    'blocco mentale',
    'sopraffatto',
    'mindfulness',
    'meditazione',
    'confessione',
    'pensieri',
    'psicologo',
    'terapia',
    'emozioni',
  ],
  inspiration: [
    'idea',
    'ispirazione',
    'brainstorm',
    'progetto',
    'separando',
    'separazione',
    'problemi legali',
    'legale',
    'debiti',
    'fisco',
    'tasse',
    'sopraffatto',
    'lavoro',
    'carriera',
    'gestire tutto',
    'creatività',
    'scrivere',
    'design',
    'business',
    'career',
    'obiettivo professionale',
  ],
  coordination: ['coordina', 'coordinamento'],
  general: [],
}

const WEIGHTED_PATTERNS: Record<Domain, Array<{ pattern: RegExp; score: number }>> = {
  general: [],
  nutrition: [
    {
      pattern: /\b(voglio|vorrei|mi serve|dammi|fammi)\b.{0,30}\b(dieta|piano alimentare|menu)\b/i,
      score: 4,
    },
    { pattern: /\b(perdere peso|dimagrire|mangiare meglio)\b/i, score: 3 },
    {
      pattern:
        /\b(gastrite|reflusso|gonfiore|problemi digestivi).{0,40}\b(mangiare|alimenti|cibo)\b/i,
      score: 4,
    },
    { pattern: /\b(allergie|intolleranze)\b.{0,30}\b(alimentari|cibo|mangiare)\b/i, score: 4 },
    { pattern: /\b(turni|pasti saltati|salto i pasti)\b/i, score: 2 },
  ],
  training: [
    { pattern: /\b(mi serve|voglio|dammi|fammi)\b.{0,30}\b(scheda|programma)\b/i, score: 4 },
    { pattern: /\b(ricominciare ad allenarmi|allenarmi meglio|allenarmi)\b/i, score: 3 },
    { pattern: /\b(protocollo di recupero|recupero)\b/i, score: 3 },
    { pattern: /\b(mi alleno male|eseguo male gli esercizi)\b/i, score: 4 },
  ],
  health: [
    { pattern: /\b(pressione alta|giramenti|vertigini)\b/i, score: 4 },
    { pattern: /\b(gonfiore|problemi digestivi|reflusso|nausea|vomito)\b/i, score: 3 },
    { pattern: /\b(sfoghi cutanei|sfogo cutaneo|eruzione|eczema)\b/i, score: 4 },
    { pattern: /\b(dolore|sintomi?)\b/i, score: 2 },
  ],
  mindfulness: [
    { pattern: /\b(stressato|stressata|stress|ansia alta|ansia intensa)\b/i, score: 4 },
    { pattern: /\b(dormo male|dormo malissimo|insonnia)\b/i, score: 4 },
    { pattern: /\b(burnout|sopraffatt[oa]|non riesco a concentrarmi|blocco mentale)\b/i, score: 5 },
  ],
  inspiration: [
    { pattern: /\b(mi sto separando|separazione)\b.{0,40}\b(problemi legali|legale)\b/i, score: 5 },
    { pattern: /\b(debiti|spese|soldi|tasse)\b.{0,40}\b(ansia|stress)\b/i, score: 4 },
    { pattern: /\b(non riesco pi[uù] a gestire tutto|sopraffatt[oa])\b/i, score: 4 },
    { pattern: /\b(bloccato nel lavoro|bloccata nel lavoro|carriera|lavoro)\b/i, score: 3 },
  ],
  coordination: [
    {
      pattern: /\b(non riesco pi[uù] a gestire tutto|mi serve organizzarmi|ho troppe cose)\b/i,
      score: 4,
    },
  ],
}

const CRITICAL_HEALTH_PATTERNS = [
  /\bdolore\s+toracic/i,
  /\bdolore\s+al\s+petto/i,
  /\bfiato\s+corto\b/i,
  /\bdispnea\b/i,
  /\bshortness\s+of\s+breath\b/i,
  /\bsenso\s+di\s+oppressione\s+al\s+petto/i,
]

function getCriticalHealthScore(text: string): number {
  return CRITICAL_HEALTH_PATTERNS.some((pattern) => pattern.test(text)) ? 8 : 0
}

function scoreDomain(text: string, domain: Domain): number {
  if (domain === 'general') return 0
  const keywordScore = KEYWORDS[domain].reduce((acc, kw) => (text.includes(kw) ? acc + 1 : acc), 0)
  const patternScore = WEIGHTED_PATTERNS[domain].reduce(
    (acc, entry) => (entry.pattern.test(text) ? acc + entry.score : acc),
    0,
  )
  const criticalHealthScore = domain === 'health' ? getCriticalHealthScore(text) : 0
  return keywordScore + patternScore + criticalHealthScore
}

export function detectDomainFromText(text: string): Domain {
  const t = text.toLowerCase()
  let best: { d: Domain; score: number } = { d: 'general', score: 0 }

  ;(Object.keys(KEYWORDS) as Domain[]).forEach((d) => {
    if (d === 'general') return
    const score = scoreDomain(t, d)
    if (score > best.score) best = { d, score }
  })

  return best.score > 0 ? best.d : 'general'
}

export function detectDomainsMulti(text: string): Array<{ domain: Domain; score: number }> {
  const t = text.toLowerCase()
  return (Object.keys(KEYWORDS) as Domain[])
    .filter((d) => d !== 'general')
    .map((d) => ({
      domain: d,
      score: scoreDomain(t, d),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
}
