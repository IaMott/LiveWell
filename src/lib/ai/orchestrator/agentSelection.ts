import { AgentProfile, Domain } from '../types'

/**
 * P6 — DEPRECATION NOTICE: AGENT_COMPETENCE_HINTS is a hardcoded fallback for
 * agents whose `profile.json` does NOT declare `competenceKeywords`. New agents
 * MUST declare their competence keywords in their profile.json (see
 * `team/schema.ts → AgentProfileSchema.competenceKeywords`). When ALL agents have
 * migrated their hints into profile.json this constant should be deleted —
 * `selectAgentsForRequest` already prefers `agent.competenceKeywords` over this map.
 *
 * Rationale: keeping competence hints in TEAM/ keeps the data layer self-contained
 * and lets new specialists be added without touching application code.
 */
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

  // ── Gruppo Idee ────────────────────────────────────────────────────────────
  // These agents are ONLY relevant when the user explicitly mentions their domain.
  // Without keywords they would score ≥2 on any 'inspiration' message, flooding
  // the pipeline with irrelevant specialists.

  commercialista: [
    'tasse',
    'fisco',
    'iva',
    'dichiarazione',
    'partita iva',
    'fattura',
    'contabilità',
    'bilancio',
    'irpef',
    'f24',
    'detrazioni',
    'acconto',
    'regime forfettario',
    'srl',
    'spa',
  ],

  'financial-planner': [
    'investimenti',
    'risparmio',
    'mutuo',
    'finanziamento',
    'pensione',
    'portafoglio',
    'debiti',
    'borsa',
    'azioni',
    'fondo',
    'etf',
    'rendimento',
    'patrimonio',
    'budget familiare',
  ],

  'career-coach': [
    'carriera',
    'lavoro',
    'professione',
    'colloquio',
    'cv',
    'licenziamento',
    'promozione',
    'cambio lavoro',
    'settore',
    'networking',
    'linkedin',
    'stipendio',
    'offerta di lavoro',
  ],

  'executive-coach': [
    'leadership',
    'manager',
    'dirigente',
    'azienda',
    'team',
    'organizzazione',
    'strategia aziendale',
    'executive',
    'ceo',
    'ruolo dirigenziale',
    'performance aziendale',
    'coaching manageriale',
  ],

  'consulente-legale': [
    'legale',
    'avvocato',
    'contratto',
    'causa',
    'diritto',
    'separazione',
    'divorzio',
    'eredità',
    'affidamento',
    'testamento',
    'tutela',
    'arbitrato',
    'procedimento legale',
  ],

  'analista-contesto': [
    'analisi',
    'dati',
    'requisiti',
    'progetto',
    'processo',
    'ricerca',
    'assessment',
    'report',
    'scenario',
    'benchmarking',
    'decisione strategica',
    'audit',
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
  //   +2  per competence-hint keyword match (current message)
  //   +1  per competence-hint keyword match (accumulated case context)
  //   ±2  feedback score adjustment (only if ≥3 ratings)
  // No hardcoded bonus for any specific agent group.
  const scored = team.map((a) => {
    let s = 0
    let msgMatchCount = 0

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
    msgMatchCount = competenceHints.filter((h) =>
      h.includes(' ') ? lowerMessage.includes(h) : [...msgTokens].some((tok) => stemMatch(tok, h)),
    ).length
    if (msgMatchCount > 0) s += msgMatchCount * 2

    // Case-context matches are stabilizers, not the core selection engine.
    if (caseContext) {
      const lowerCase = caseContext.toLowerCase()
      const caseTokens = textToTokens(caseContext)
      const caseMatches = competenceHints.filter((h) =>
        h.includes(' ') ? lowerCase.includes(h) : [...caseTokens].some((tok) => stemMatch(tok, h)),
      ).length
      if (caseMatches > 0) s += caseMatches
    }

    // RELEVANCE PENALTY: Specialist has many specific competence keywords but NONE
    // match the current message. Prevents off-domain specialists (e.g. allergologo
    // on a back-pain/spine message) from being selected purely on domain score.
    // Only applied when the message is non-trivial (> 20 chars) to avoid penalising
    // short greetings where competence detection is unreliable.
    // NOT applied to secondary-domain-only agents: they already scored only +2 from
    // the secondary bonus; the penalty would unfairly cancel that when the user uses
    // synonyms not in the keyword list (e.g. "stomaco" instead of "gastrite").
    // Primary-domain agents still get the penalty — if health is the PRIMARY domain
    // and an agent has 0 keyword matches, it's likely not the right specialist.
    const hasSecondaryOnly =
      !a.domainTags.includes(domain) && secondary.some((d) => a.domainTags.includes(d))
    if (
      competenceHints.length > 5 &&
      msgMatchCount === 0 &&
      lowerMessage.length > 20 &&
      !hasSecondaryOnly
    ) {
      s -= 3
    }

    // Feedback scoring: +2 if highly rated (≥4.0), -2 if poorly rated (≤2.0)
    // Only applies if user has given ≥3 ratings for this agent
    const avgRating = agentFeedbackScores[a.id]
    if (avgRating !== undefined) {
      s += Math.round((avgRating - 3) * 1.0) // 5★ → +2, 3★ → 0, 1★ → -2
    }

    return { agent: a, score: s, msgMatchCount }
  })

  // F3: Filter out low-confidence specialists.
  // Rule: score > 2 always passes. score === 2 passes ONLY if there is at least 1
  // explicit keyword match in the current message. This distinction is critical:
  //
  //   gastroenterologo + "gastrite" message (no secondary health domain detected):
  //     score = 0 (no domain) + 2 (gastrite keyword) = 2, msgMatchCount = 1 → INCLUDED ✅
  //
  //   relationship-coach on nutrition message (secondary mindfulness detected):
  //     score = 2 (secondary mindfulness), msgMatchCount = 0 → EXCLUDED ✅
  //
  // Score 0-1 = too weak regardless of keyword matches → always excluded.
  const sorted = scored.sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id))
  const filtered = sorted
    .filter((x) => x.score > 2 || (x.score === 2 && x.msgMatchCount > 0))
    .slice(0, maxAgents)

  // Garantisce che almeno 1 agente sia sempre selezionato per messaggi generici/saluti.
  // Fallback: se nessun agente specialista supera la soglia, usa l'orchestratore o il
  // coordinatore (agente con domainTag 'coordination') se presente nel team.
  // In questo modo il fallback è selettivo: non si attiva su team mock senza coordinatori.
  if (filtered.length === 0) {
    // Prefer the main coordinator by id ('orchestratore') before falling back to any
    // agent that happens to have a 'coordination' domainTag. Multiple agents carry
    // 'coordination' (analista-contesto, commercialista, life-organizer, etc.) and
    // alphabetical ordering would pick analista-contesto ahead of orchestratore.
    const coordinator =
      sorted.find((x) => x.agent.id === 'orchestratore') ??
      sorted.find((x) => (x.agent.domainTags as string[]).includes('coordination'))
    if (coordinator) return [coordinator.agent]
  }

  return filtered.map((x) => x.agent)
}
