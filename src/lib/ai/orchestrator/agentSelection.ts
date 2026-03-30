import { AgentProfile, Domain } from '../types'

const AGENT_COMPETENCE_HINTS: Record<string, string[]> = {
  fisioterapista: [
    'schiena',
    'lombalgia',
    'sciatica',
    'postura',
    'riabilitazione',
    'muscolo',
    'collo',
    'cervicale',
    'torcicollo',
    'contrattura',
    'strappo',
    'spalla',
    'gomito',
    'polso',
    'anca',
    'ginocchio',
    'caviglia',
    'tendinite',
    'fascite',
    'dolore',
    'trapezio',
    'nervo',
    'infiammazione',
    'irradiazione',
  ],
  fisiatra: [
    'schiena',
    'dolore',
    'articolazione',
    'riabilitazione',
    'colonna',
    'muscolo',
    'collo',
    'cervicale',
    'lombari',
    'nervo',
    'formicolio',
    'ernia',
    'discopatia',
    'protocollo',
    'recupero',
  ],
  'medico-dello-sport': [
    'infortunio',
    'recupero',
    'muscolo',
    'allenamento',
    'sport',
    'prestazione',
    'agonismo',
    'idoneità',
  ],
  cardiologo: [
    'cuore',
    'tachicardia',
    'pressione',
    'palpitazioni',
    'torace',
    'aritmia',
    'fibrillazione',
    'angina',
    'colesterolo',
    'trigliceridi',
    'infarto',
    'sincope',
    'affanno',
  ],
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
    'gonfiore',
    'stitichezza',
    'diarrea',
    'rettocolite',
    'crohn',
    'celiachia',
    'emorroidi',
    'colon',
  ],
  dermatologo: [
    'pelle',
    'rash',
    'eczema',
    'dermatite',
    'acne',
    'prurito',
    'macchia',
    'neo',
    'orticaria',
    'psoriasi',
    'forfora',
    'caduta',
    'capelli',
    'unghie',
    'cicatrice',
    'rossore',
  ],
  dietista: [
    'dieta',
    'pasto',
    'ricetta',
    'menu',
    'schema alimentare',
    'porzioni',
    'fabbisogno calorico',
    'calorie',
    'alimentazione',
    'macros',
    'deficit',
    'peso',
    'dimagrire',
    'ingrassare',
  ],
  endocrinologo: [
    'tiroide',
    'glicemia',
    'ormoni',
    'insulina',
    'metabolismo',
    'diabete',
    'ipotiroidismo',
    'ipertiroidismo',
    'testosterone',
    'estrogeni',
    'cortisolo',
    'surrenale',
    'ipofisi',
    'menopausa',
  ],
  psicologo: [
    'ansia',
    'umore',
    'stress',
    'panico',
    'depressione',
    'triste',
    'preoccupato',
    'angoscia',
    'fobia',
    'trauma',
    'lutto',
    'burnout',
    'autostima',
    'blocco',
    'emozioni',
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
    'omega',
    'probiotici',
    'prebiotici',
    'magnesio',
    'ferro',
    'vitamina',
  ],
  dietologo: [
    'diabete',
    'colesterolo',
    'metabolismo',
    'celiachia',
    'sovrappeso',
    'dislipidemia',
    'dieta',
    'obesità',
    'resistenza insulinica',
    'patologia',
    'medica',
  ],
  psichiatra: [
    'psicofarmaci',
    'antidepressivi',
    'ansiolitici',
    'bipolare',
    'schizofrenia',
    'psicosi',
    'farmaci',
    'disturbo',
    'ossessivo',
    'compulsivo',
    'deliri',
    'allucinazioni',
    'mania',
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
    'rigidità',
    'mattutina',
    'gotta',
    'spondilite',
    'sjogren',
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
    'stanchezza',
    'riposo',
    'notte',
    'russare',
  ],
  'persona-trainer': [
    'allenamento',
    'palestra',
    'esercizio',
    'workout',
    'forza',
    'resistenza',
    'stretching',
    'muscolatura',
    'cardio',
    'scheda',
    'riscaldamento',
    'progressione',
  ],
  mmg: [
    'febbre',
    'malessere',
    'visita',
    'ricetta',
    'esami',
    'farmaco',
    'sintomi',
    'influenza',
    'tosse',
    'raffreddore',
    'stanchezza',
    'generico',
    'curante',
    'certificato',
    'testa',
    'cefalea',
    'mal',
  ],
  chef: ['ricetta', 'cucina', 'piatto', 'ingredienti', 'preparazione', 'cottura', 'cucinare'],
  chinesologo: ['movimento', 'postura', 'ginnastica', 'esercizio', 'motoria', 'coordinazione'],
  'mental-coach': [
    'motivazione',
    'obiettivi',
    'focus',
    'resilienza',
    'mentalità',
    'performance',
    'disciplina',
    'abitudini',
    'procrastinazione',
  ],
  'relationship-coach': [
    'relazione',
    'coppia',
    'comunicazione',
    'partner',
    'conflitto',
    'famiglia',
    'amore',
    'separazione',
  ],
  'life-organizer': [
    'organizzazione',
    'priorità',
    'tempo',
    'produttività',
    'pianificazione',
    'agenda',
    'routine',
    'abitudini',
  ],
  // ── Nuovi specialisti ────────────────────────────────────────────────────
  neurologo: [
    'cefalea',
    'emicrania',
    'vertigini',
    'formicolio',
    'nervo',
    'neuropatia',
    'tremore',
    'epilessia',
    'convulsioni',
    'intorpidimento',
    'diplopia',
    'memoria',
    'concentrazione',
    'cervicale',
    'irradiazione',
    'dolore neuropatico',
    'sciatica',
    'radiculopatia',
  ],
  ortopedico: [
    'frattura',
    'osso',
    'protesi',
    'artrosi',
    'menisco',
    'legamento',
    'tendine',
    'lussazione',
    'distorsione',
    'scoliosi',
    'ernia',
    'artrite',
    'ginocchio',
    'anca',
    'spalla',
    'colonna',
    'vertebra',
    'disco',
    'trauma',
  ],
  urologo: [
    'urinare',
    'vescica',
    'prostata',
    'rene',
    'calcoli',
    'ematuria',
    'bruciore',
    'minzione',
    'incontinenza',
    'frequenza',
    'sessuale',
    'disfunzione',
    'fertilità',
  ],
  oculista: [
    'vista',
    'visione',
    'occhio',
    'miopia',
    'astigmatismo',
    'presbiopia',
    'cataratta',
    'glaucoma',
    'retina',
    'diplopia',
    'bruciore occhi',
    'lacrimazione',
    'occhio secco',
    'lenti',
    'occhiali',
  ],
  otorinolaringoiatra: [
    'orecchio',
    'udito',
    'acufeni',
    'naso',
    'sinusite',
    'rinite',
    'gola',
    'tonsille',
    'voce',
    'disfonia',
    'laringite',
    'faringite',
    'roncopatia',
    'russare',
    'vertigini',
    'epistassi',
    'sangue dal naso',
  ],
  pneumologo: [
    'respiro',
    'tosse',
    'asma',
    'bronchite',
    'polmoni',
    'dispnea',
    'fiato',
    'affanno',
    'saturazione',
    'bpco',
    'polmonite',
    'fumo',
    'tabagismo',
    'apnea',
    'russare',
    'catarro',
  ],

  // ── New specialists ───────────────────────────────────────────────────────

  ginecologo: [
    'ciclo',
    'mestruo',
    'mestruazioni',
    'menopausa',
    'gravidanza',
    'ovaia',
    'utero',
    'vagina',
    'pelvico',
    'endometriosi',
    'pcos',
    'fibromi',
    'contraccettivi',
    'pillola',
    'fertilità',
    'ovulazione',
    'spotting',
    'dismenorrea',
    'amenorrea',
    'perimenopausa',
    'paptest',
    'hpv',
    'vaginosi',
    'candida',
  ],

  diabetologo: [
    'glicemia',
    'insulina',
    'diabete',
    'hba1c',
    'glucosio',
    'ipoglicemia',
    'iperglicemia',
    'metformina',
    'pancreas',
    'resistenza insulinica',
    'chetoacidosi',
    'cgm',
    'microinfusore',
    'glucometro',
    'piede diabetico',
    'nefropatia diabetica',
    'retinopatia diabetica',
    'diabete gestazionale',
    'prediabete',
  ],

  infettivologo: [
    'infezione',
    'febbre',
    'virus',
    'batterio',
    'antibiotico',
    'hiv',
    'epatite',
    'tubercolosi',
    'sepsi',
    'vaccino',
    'immunodeficienza',
    'malaria',
    'dengue',
    'prep',
    'pep',
    'contagio',
    'resistenza batterica',
    'meningite',
    'mononucleosi',
    'herpes',
    'candidosi sistemica',
  ],

  oncologo: [
    'tumore',
    'cancro',
    'neoplasia',
    'chemioterapia',
    'radioterapia',
    'metastasi',
    'oncologia',
    'biopsia',
    'remissione',
    'recidiva',
    'immunoterapia',
    'fatigue oncologica',
    'cachessia',
    'cure palliative',
    'terapia target',
    'marcatori tumorali',
    'stadiazione',
  ],

  allergologo: [
    'allergia',
    'allergico',
    'orticaria',
    'angioedema',
    'anafilassi',
    'rinite allergica',
    'polline',
    'acari',
    'nichel',
    'lattice',
    'allergia alimentare',
    'intolleranza',
    'asma allergico',
    'dermatite atopica',
    'prurito',
    'gonfiore',
    'eczema',
    'prick test',
    'immunoterapia allergene',
    'adrenalina',
    'epipen',
  ],

  geriatra: [
    'anziano',
    'anziana',
    'nonno',
    'nonna',
    'demenza',
    'alzheimer',
    'caduta',
    'fragilità',
    'sarcopenia',
    'delirium',
    'polifarmacoterapia',
    'deterioramento cognitivo',
    'mci',
    'memoria',
    'incontinenza',
    'disfagia',
    'malnutrizione anziano',
    'ospedalizzazione anziano',
    'geriatria',
    'età avanzata',
    'cure fine vita',
  ],
}

function textToTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9àèéìòù_\-\s]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  )
}

/**
 * Italian-aware stem match: handles plurals, conjugation, gender suffixes.
 * E.g. "occhi" ↔ "occhio", "muscoli" ↔ "muscolo", "allergia" ↔ "allergie"
 * Constraints:
 * - Both words must be ≥ 4 chars (avoids false positives on short words)
 * - Length difference ≤ 2 (Italian inflections change at most 1-2 chars)
 * - Shared prefix of at least (shorter.length - 1) chars
 */
function stemMatch(token: string, hint: string): boolean {
  if (token === hint) return true
  if (token.length < 4 || hint.length < 4) return false
  // Italian inflections differ by at most 1-2 chars (o→i, a→e, e→i, +ne, etc.)
  if (Math.abs(token.length - hint.length) > 2) return false
  const shorter = token.length <= hint.length ? token : hint
  const longer = token.length > hint.length ? token : hint
  const stemLen = Math.max(3, shorter.length - 1)
  return longer.startsWith(shorter.slice(0, stemLen))
}

export function selectAgentsForRequest(
  team: AgentProfile[],
  domain: Domain,
  maxAgents: number,
  allDomains: Domain[] = [],
  message = '',
  caseContext = '',
  agentFeedbackScores: Record<string, number> = {},
  options: { preferredAgentIds?: string[] } = {},
): AgentProfile[] {
  const secondary = allDomains.filter((d) => d !== domain && d !== 'general')
  const lowerMessage = message.toLowerCase()
  const msgTokens = textToTokens(message)
  const preferredAgentOrder = options.preferredAgentIds ?? []
  const preferredAgentRanks = new Map(preferredAgentOrder.map((id, index) => [id, index]))

  // Scoring is fully general — same rules for every agent:
  //   +4  primary domain match
  //   +1  'general' domain tag
  //   +2  each secondary domain match
  //   +2  agent id or displayName mentioned in message
  //   +3  per competence-hint keyword match (current message)
  //   +2  per competence-hint keyword match (accumulated case context)
  //   ±2  feedback score adjustment (only if ≥3 ratings)
  // No hardcoded bonus for any specific agent group.
  const scored = team.map((a) => ({
    agent: a,
    score: (() => {
      let s = 0
      if (a.domainTags.includes(domain)) s += 4
      if (a.domainTags.includes('general')) s += 1
      for (const d of secondary) if (a.domainTags.includes(d)) s += 2
      const preferredRank = preferredAgentRanks.get(a.id)
      if (preferredRank !== undefined) {
        s += Math.max(6, 10 - preferredRank * 2)
      }
      if (lowerMessage.includes(a.id.toLowerCase())) s += 2
      if (lowerMessage.includes(a.displayName.toLowerCase())) s += 2

      const competenceHints = a.competenceKeywords ?? AGENT_COMPETENCE_HINTS[a.id] ?? []
      // Competence hints remain a booster, not the main routing driver.
      // Uses stemMatch for Italian morphology: "occhi" matches "occhio", etc.
      const msgMatches = competenceHints.filter((h) =>
        h.includes(' ')
          ? lowerMessage.includes(h)
          : [...msgTokens].some((tok) => stemMatch(tok, h)),
      ).length
      if (msgMatches > 0) s += msgMatches * 2

      // Case-context matches are stabilizers, not the core selection engine.
      if (caseContext) {
        const lowerCase = caseContext.toLowerCase()
        const caseTokens = textToTokens(caseContext)
        const caseMatches = competenceHints.filter((h) =>
          h.includes(' ')
            ? lowerCase.includes(h)
            : [...caseTokens].some((tok) => stemMatch(tok, h)),
        ).length
        if (caseMatches > 0) s += caseMatches
      }

      // Feedback scoring: +2 if highly rated (≥4.0), -2 if poorly rated (≤2.0)
      // Only applies if user has given ≥3 ratings for this agent
      const avgRating = agentFeedbackScores[a.id]
      if (avgRating !== undefined) {
        s += Math.round((avgRating - 3) * 1.0) // 5★ → +2, 3★ → 0, 1★ → -2
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
