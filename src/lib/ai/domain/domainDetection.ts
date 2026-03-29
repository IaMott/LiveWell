import type { Domain } from '../types'

// ──────────────────────────────────────────────────────────────────────
// KEYWORDS — used for basic domain scoring.
// Convention:
//   - Words ending in a vowel → exact word match  (\bword\b)
//   - Words ending in a consonant → prefix match  (\bword)
//     so "digestiv" matches "digestivo", "digestivi", etc.
//   - Multi-word phrases → substring match (text.includes)
// ──────────────────────────────────────────────────────────────────────
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
    'allergie alimentari',
    'intolleranze alimentari',
    'alimentazione',
    'gastrite',
    'digestiv',
    'addominal',
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
    'reflusso',
    'salto i pasti',
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
    'correre',
    'corsa',
    'ricominciare',
    'riprendere ad allenarmi',
  ],
  health: [
    'dolore',
    'male',
    'infortunio',
    'sintomo',
    'medico',
    'farmaco',
    'allergia',
    'condizione',
    'salute',
    'torac',
    'petto',
    'tachic',
    'palpit',
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
    'pelle',
    'rash',
    'prurito',
    'cutanei',
    'eczema',
    'pressione alta',
    'mi duole',
    'mi fa male',
    'mi sono fatto male',
    'mi è venuto',
    'ho un fastidio',
    'mi tira',
    'mi si è bloccato',
    // ── Body parts (complete set) ──
    'ginocchio',
    'schiena',
    'spalla',
    'caviglia',
    'collo',
    'cervicale',
    'cervicali',
    'torcicollo',
    'polso',
    'gomito',
    'anca',
    'piede',
    'piedi',
    'braccio',
    'gamba',
    'coscia',
    'tallone',
    'testa',
    'mandibola',
    'bacino',
    'lombare',
    'lombari',
    'sciatica',
    // ── Tissue/injury ──
    'muscolo',
    'muscoli',
    'muscolare',
    'tendinite',
    'strappo',
    'contrattura',
    'nervo',
    'formicolio',
    'intorpidimento',
    // ── Systems ──
    'ormoni',
    'tiroide',
    'insulina',
    'metabolismo',
    'glicemia',
    'pressione',
  ],
  mindfulness: [
    'ansia',
    'stress',
    'umore',
    'sonno',
    'risvegli',
    'risvegli notturni',
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
    'focus',
    'burn out',
    'esaurito',
    'morale',
    'giù di morale',
    'depresso',
    'triste',
    'mi sento giù',
    'non ce la faccio',
    'mi sento male emotivamente',
    'mi sento solo',
    'sento un peso',
    'non ho voglia',
    'demotivato',
    'angoscia',
    'panico',
    'attacco di panico',
  ],
  inspiration: [
    'idea',
    'ispirazione',
    'brainstorm',
    'progetto',
    'separando',
    'separazione',
    'affido',
    'accordi',
    'avvocato',
    'problemi legali',
    'legale',
    'debiti',
    'mutuo',
    'rate',
    'bollette',
    'spese',
    'fisco',
    'tasse',
    'sopraffatto',
    'problemi pratici',
    'figli',
    'priorità',
    'priorita',
    'ordine',
    'carriera',
    'gestire tutto',
    'creatività',
    'scrivere',
    'design',
    'business',
    'career',
    'obiettivo professionale',
    // NOTE: "lavoro" removed as standalone keyword — too ambiguous.
    // It's still caught by WEIGHTED_PATTERNS when used in career-specific context.
  ],
  coordination: [
    'coordina',
    'coordinamento',
    'organizzarmi',
    'organizzazione',
    'priorità',
    'priorita',
    'gestire tutto',
    'ordine',
  ],
  general: [],
}

// ──────────────────────────────────────────────────────────────────────
// Pre-compiled keyword matchers.
// Single-word keywords ending in vowel → exact \bword\b
// Single-word keywords ending in consonant → prefix \bword  (Italian stems)
// Multi-word phrases → text.includes() (already specific enough)
// ──────────────────────────────────────────────────────────────────────
type KeywordMatcher = { test: (text: string) => boolean }

function buildKeywordMatcher(keyword: string): KeywordMatcher {
  if (keyword.includes(' ')) {
    // Multi-word phrase: simple substring (already specific)
    return { test: (text: string) => text.includes(keyword) }
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const isPrefix = /[bcdfghlmnpqrstvwxyz]$/i.test(keyword)
  const re = new RegExp(isPrefix ? `\\b${escaped}` : `\\b${escaped}\\b`, 'i')
  return { test: (text: string) => re.test(text) }
}

const KEYWORD_MATCHERS: Record<Domain, KeywordMatcher[]> = {} as Record<Domain, KeywordMatcher[]>
for (const domain of Object.keys(KEYWORDS) as Domain[]) {
  KEYWORD_MATCHERS[domain] = KEYWORDS[domain].map(buildKeywordMatcher)
}

const WEIGHTED_PATTERNS: Record<Domain, Array<{ pattern: RegExp; score: number }>> = {
  general: [],
  nutrition: [
    {
      pattern: /\b(voglio|vorrei|mi serve|dammi|fammi)\b.{0,30}\b(dieta|piano alimentare|menu)\b/i,
      score: 4,
    },
    {
      pattern: /\b(voglio|vorrei|mi serve)\b.{0,30}\b(mangiare meglio|alimentazione)\b/i,
      score: 4,
    },
    { pattern: /\b(perdere peso|dimagrire|mangiare meglio)\b/i, score: 3 },
    {
      pattern:
        /\b(aggiorna(?:re)?|riprova(?:\s+ad)?\s+aggiorna(?:re)?|salva(?:re)?|registra(?:re)?)\b.{0,20}\b(peso|altezza)\b|\b(peso|altezza)\b.{0,20}\b(aggiorna(?:re)?|salva(?:re)?|registra(?:re)?)\b/i,
      score: 4,
    },
    {
      pattern:
        /\b(gastrite|reflusso|gonfiore|problemi digestivi).{0,40}\b(mangiare|alimenti|cibo)\b/i,
      score: 4,
    },
    { pattern: /\b(allergie|intolleranze)\b.{0,30}\b(alimentari|cibo|mangiare)\b/i, score: 4 },
    { pattern: /\b(turni|pasti saltati|salto i pasti)\b/i, score: 2 },
    {
      pattern:
        /\b(non so cosa mangiare|cosa mangiare)\b.{0,20}\b(gastrite|reflusso|gonfiore)\b|\b(gastrite|reflusso|gonfiore)\b.{0,20}\b(non so cosa mangiare|cosa mangiare)\b/i,
      score: 5,
    },
  ],
  training: [
    { pattern: /\b(mi serve|voglio|dammi|fammi)\b.{0,30}\b(scheda|programma)\b/i, score: 4 },
    { pattern: /\b(ricominciare ad allenarmi|allenarmi meglio|allenarmi)\b/i, score: 3 },
    {
      pattern: /\b(riprendere ad allenarmi|riprendere a correre|voglio riprendere)\b/i,
      score: 4,
    },
    { pattern: /\b(protocollo di recupero|recupero)\b/i, score: 3 },
    { pattern: /\b(mi alleno male|eseguo male gli esercizi)\b/i, score: 4 },
  ],
  health: [
    { pattern: /\b(pressione alta|giramenti|vertigini)\b/i, score: 4 },
    {
      pattern: /\b(tachicardia|palpitazioni|pressione alta|giramenti|vertigini)\b/i,
      score: 5,
    },
    {
      pattern:
        /\b(gonfiore|problemi digestivi|digestione difficile|dolore addominale|crampi addominali|reflusso|nausea|vomito)\b/i,
      score: 4,
    },
    {
      pattern:
        /\b(sfoghi cutanei|sfogo cutaneo|eruzione|eczema|rash|prurito|dermatite|acne persistente)\b/i,
      score: 5,
    },
    {
      pattern: /\b(ormoni|tiroide|insulina|metabolismo|glicemia)\b/i,
      score: 4,
    },
    // ── "ho male al [body part]" — the most common Italian pain expression ──
    {
      pattern: /\b(ho male|mi fa male|mi fanno male|fa male|avevo male|aveva male)\b/i,
      score: 3,
    },
    {
      pattern:
        /\b(male|dolore|fa male)\b.{0,25}\b(collo|cervicale|testa|schiena|spalla|ginocchio|caviglia|piede|braccio|gamba|polso|gomito|anca|coscia|tallone|mandibola|bacino|lombare)\b/i,
      score: 5,
    },
    {
      pattern:
        /\b(collo|cervicale|testa|schiena|spalla|ginocchio|caviglia|piede|braccio|gamba|polso|gomito|anca|coscia|tallone|mandibola|bacino|lombare)\b.{0,25}\b(male|dolore|fa male)\b/i,
      score: 5,
    },
    {
      pattern:
        /\b(mi fa male|dolore)\b.{0,25}\b(ginocchio|schiena|spalla|caviglia)\b|\b(ginocchio|schiena|spalla|caviglia)\b.{0,25}\b(mi fa male|dolore)\b/i,
      score: 4,
    },
    {
      pattern:
        /\b(corro|correndo|corsa|allenamento|mi alleno)\b.{0,30}\b(dolore|male|infortunio)\b|\b(dolore|male|infortunio)\b.{0,30}\b(corro|correndo|corsa|allenamento|mi alleno)\b/i,
      score: 4,
    },
    {
      pattern: /\b(contrattura|strappo|tendinite|formicolio|intorpidimento|torcicollo)\b/i,
      score: 4,
    },
    { pattern: /\b(dolore|sintomi?)\b/i, score: 2 },
  ],
  mindfulness: [
    { pattern: /\b(stressato|stressata|stress|ansia alta|ansia intensa)\b/i, score: 4 },
    { pattern: /\b(dormo male|dormo malissimo|insonnia)\b/i, score: 4 },
    { pattern: /\b(risvegli notturni|mi sveglio|mi risveglio)\b/i, score: 5 },
    { pattern: /\b(caff[eè])\b.{0,25}\b(sera|tardi|18|19|20|notte)\b/i, score: 3 },
    {
      pattern: /\b(burnout|sopraffatt[oa]|non riesco a concentrarmi|blocco mentale)\b/i,
      score: 5,
    },
    {
      pattern:
        /\b(lavoro|focus|concentrarmi)\b.{0,30}\b(stress|ansia|burnout)\b|\b(stress|ansia|burnout)\b.{0,30}\b(lavoro|focus|concentrarmi)\b/i,
      score: 4,
    },
    {
      pattern: /\b(giù di morale|butta giù|buttato giù|depresso|triste|tristezza)\b/i,
      score: 4,
    },
  ],
  inspiration: [
    {
      pattern:
        /\b(mi sto separando|separazione)\b.{0,50}\b(problemi legali|legale|accordi|tutela|affido|avvocat)\b/i,
      score: 6,
    },
    {
      pattern:
        /\b(debiti|mutuo|spese|soldi|rate|bollette|tasse)\b.{0,40}\b(ansia|stress|sopraffatt)\b/i,
      score: 5,
    },
    {
      pattern: /\b(debiti|mutuo|spese|soldi|rate|bollette|tasse)\b/i,
      score: 3,
    },
    {
      pattern:
        /\b(mi sto separando|separazione)\b.{0,50}\b(problemi pratici|figli|soldi|gestire|cosa fare)\b/i,
      score: 4,
    },
    { pattern: /\b(non riesco pi[uù] a gestire tutto|sopraffatt[oa])\b/i, score: 2 },
    // "lavoro" alone is NOT enough — must be in an explicit career context
    {
      pattern: /\b(bloccato nel lavoro|bloccata nel lavoro|carriera|obiettivo professionale)\b/i,
      score: 3,
    },
    {
      pattern: /\b(cambiare lavoro|cerco lavoro|colloquio|promozione|ruolo)\b/i,
      score: 4,
    },
  ],
  coordination: [
    {
      pattern:
        /\b(non riesco pi[uù] a gestire tutto|mi serve organizzarmi|ho troppe cose|non riesco a organizzarmi|devo incastrare tutto)\b/i,
      score: 5,
    },
    {
      pattern:
        /\b(rimettere in ordine|fare ordine|mettere ordine)\b.{0,40}\b(vita|soldi|priorit[àa])\b|\b(vita|soldi|priorit[àa])\b.{0,40}\b(rimettere in ordine|fare ordine|mettere ordine)\b/i,
      score: 5,
    },
    {
      pattern: /\b(non so da dove partire|troppi fronti|troppe aree|quadro confuso)\b/i,
      score: 4,
    },
    {
      pattern:
        /\b(mi sto separando|separazione)\b.{0,60}\b(figli|soldi|problemi pratici|gestire)\b|\b(figli|soldi|problemi pratici|gestire)\b.{0,60}\b(mi sto separando|separazione)\b/i,
      score: 9,
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

// ──────────────────────────────────────────────────────────────────────
// Contextual dampening — reduces scores when a keyword appears in an
// incidental/temporal context rather than a topical one.
// ──────────────────────────────────────────────────────────────────────
function getContextualDampening(text: string, domain: Domain): number {
  // "lavoro" used in temporal context → NOT a career topic
  if (domain === 'inspiration') {
    const temporalWork =
      /\b(finito di lavorare|giornata di lavoro|giornata lavorativa|tornato dal lavoro|dopo il lavoro|esco dal lavoro|uscito dal lavoro|pausa lavoro|prima del lavoro|durante il lavoro|andare al lavoro|vado al lavoro|vengo dal lavoro)\b/i
    if (temporalWork.test(text)) {
      // If the ONLY inspiration signal is the temporal "lavoro" reference,
      // dampen hard. If there are other career signals, don't dampen.
      const hasCareerSignal =
        /\b(carriera|promozione|colloquio|ruolo|cambio lavoro|cerco lavoro|obiettivo professionale|bloccato nel lavoro)\b/i
      if (!hasCareerSignal.test(text)) {
        return -5
      }
    }
  }
  return 0
}

function getNegativeDomainAdjustment(text: string, domain: Domain): number {
  if (domain === 'nutrition') {
    if (/\bnon voglio parlare di (alimentazione|cibo|dieta|nutrizione)\b/i.test(text)) return -8
  }

  if (domain === 'inspiration') {
    if (
      /\bnon la carriera\b|\bnon voglio parlare di carriera\b|\bnon è la carriera\b/i.test(text)
    ) {
      return -8
    }
    if (
      /\b(burnout|stress|ansia|focus|concentrarmi)\b/i.test(text) &&
      /\b(lavoro|carriera)\b/i.test(text) &&
      /\bnon la carriera\b/i.test(text)
    ) {
      return -10
    }
    if (
      /\b(mi sto separando|separazione)\b/i.test(text) &&
      /\b(figli|soldi|problemi pratici|gestire)\b/i.test(text) &&
      !/\b(legale|accordi|affido|tutela|avvocat|lavoro|carriera|colloquio|ruolo)\b/i.test(text)
    ) {
      return -3
    }
  }

  if (domain === 'health') {
    if (
      /\b(risvegli notturni|mi sveglio|mi risveglio|insonnia|dormo male)\b/i.test(text) &&
      !/\b(dolore|tachicardia|pressione alta|rash|prurito|reflusso|gastrite)\b/i.test(text)
    ) {
      return -3
    }
  }

  return 0
}

function scoreDomain(text: string, domain: Domain): number {
  if (domain === 'general') return 0
  const keywordScore = KEYWORD_MATCHERS[domain].reduce(
    (acc, matcher) => (matcher.test(text) ? acc + 1 : acc),
    0,
  )
  const patternScore = WEIGHTED_PATTERNS[domain].reduce(
    (acc, entry) => (entry.pattern.test(text) ? acc + entry.score : acc),
    0,
  )
  const criticalHealthScore = domain === 'health' ? getCriticalHealthScore(text) : 0
  return (
    keywordScore +
    patternScore +
    criticalHealthScore +
    getNegativeDomainAdjustment(text, domain) +
    getContextualDampening(text, domain)
  )
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

/**
 * Return all domains with a positive score, sorted descending.
 * Domains with score < MULTI_DOMAIN_MIN_SCORE are filtered out so that
 * incidental keyword matches don't trigger multi-domain triage.
 */
export const MULTI_DOMAIN_MIN_SCORE = 3

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

/**
 * Like detectDomainsMulti but only returns domains with score >= MULTI_DOMAIN_MIN_SCORE.
 * Used by the orchestrator to decide if a message is genuinely multi-domain.
 */
export function detectSignificantDomains(text: string): Array<{ domain: Domain; score: number }> {
  return detectDomainsMulti(text).filter((x) => x.score >= MULTI_DOMAIN_MIN_SCORE)
}
