import { AgentProfile, DecisionTraceEvent, Domain } from '../types'
import { selectAgentsForRequest } from './agentSelection'
import { buildAgentsSelectedTraceEvent } from './decisionTrace'

// ---------------------------------------------------------------------------
// 3A — SYMPTOM_CLUSTER_RULES + detectMultiSpecialistNeed
//
// Matching strategy:
//   • Each term is matched as a substring (includes) → covers conjugations,
//     adjectives, medical/colloquial variants
//   • Within a keyword group: OR (any term matches)
//   • Between groups: AND (ALL groups must match)
//   • Cluster fires only when every group has at least one match
// ---------------------------------------------------------------------------

type SymptomCluster = {
  keywords: string[][]
  specialists: string[]
  urgency: 'alta' | 'media'
}

const SYMPTOM_CLUSTER_RULES: SymptomCluster[] = [
  // Cardiometabolic: heart symptoms + energy + weight
  {
    keywords: [
      [
        'tachicard',
        'palpitaz',
        'battito',
        'cuore batte',
        'cuore forte',
        'cuore che',
        'aritmia',
        'fibrillaz',
        'cardio',
        'cardiaco',
        'cardiovascol',
        'cardiopatico',
        'infarto',
        'angina',
        'cuore',
        'battiti',
        'irregolare il cuore',
        'sento il cuore',
      ],
      [
        'stanc',
        'affatica',
        'senza forze',
        'senza energia',
        'esaurit',
        'spossato',
        'senza fiato',
        'fiato corto',
        'energie',
        'mi sento vuoto',
        'non ce la faccio',
        'sempre stanco',
        'svogliat',
        'prostrat',
        'sfinit',
        'debole',
        'non ho energie',
        'mancanza di energia',
      ],
      [
        'peso',
        'ingrassand',
        'aumento di peso',
        'dimagr',
        'chili',
        'bmi',
        'grasso',
        'sovrappeso',
        'obesità',
        'grassino',
        'pancia',
        'sto ingrassando',
        'sto dimagrendo',
        'chili in più',
      ],
    ],
    specialists: ['cardiologo', 'endocrinologo'],
    urgency: 'alta',
  },

  // Sleep-metabolism: sleep issues + energy + metabolic
  {
    keywords: [
      [
        'sonno',
        'insonnia',
        'dorm',
        'svegl',
        'riposo',
        'notte',
        'addorment',
        'risvegl',
        'dormo male',
        'non riesco a dormire',
        'mi sveglio',
        'latenza',
        'sonno disturbato',
        'apnea',
        'russare',
        'qualità del sonno',
      ],
      [
        'stanc',
        'affatica',
        'senza energia',
        'senza forze',
        'esaurit',
        'spossato',
        'energie basse',
        'mi sento vuoto',
        'sempre stanco',
        'debole',
        'non ho energie',
        'svogliat',
      ],
      [
        'peso',
        'metabol',
        'ormoni',
        'tireoide',
        'insulina',
        'glicemia',
        'grasso',
        'dimagr',
        'ipotiroidismo',
        'ipertiroidismo',
        'cortisolo',
        'metabolismo lento',
        'non perdo peso',
      ],
    ],
    specialists: ['endocrinologo', 'sleep-coach'],
    urgency: 'media',
  },

  // Rehabilitative: pain + motor function
  {
    keywords: [
      [
        'dolor',
        'male a',
        'fa male',
        'mi fa male',
        'lesion',
        'infortun',
        'trauma',
        'rottur',
        'stiramento',
        'contrattura',
        'tendin',
        'infiammaz',
        'dolore acuto',
        'dolore cronico',
        'mi duole',
        'ho male',
        'fitte',
        'bruciore',
        'rigidità',
        'contusion',
        'distorsion',
      ],
      [
        'fisioter',
        'riabilit',
        'recuper',
        'moviment',
        'cammin',
        'poso peso',
        'muov',
        'articolaz',
        'schiena',
        'ginocchio',
        'spalla',
        'anca',
        'collo',
        'lombar',
        'cervical',
        'dorsale',
        'colonna',
        'vertebr',
        'non riesco a muovermi',
        'limitato nei movimenti',
        'rigido',
      ],
    ],
    specialists: ['fisioterapista', 'fisiatra'],
    urgency: 'media',
  },

  // Sport-nutrition: eating + athletic performance
  {
    keywords: [
      [
        'mangio',
        'alimentaz',
        'nutriz',
        'dieta',
        'calorie',
        'proteina',
        'carboidrat',
        'macro',
        'cibo',
        'pasto',
        'nutrizione',
        'integratori',
        'cosa mangiare',
        'quando mangiare',
        'pre-workout',
        'post-workout',
        'carico di carboidrati',
        'proteine',
        'deficit calorico',
      ],
      [
        'allena',
        'sport',
        'gara',
        'competiz',
        'performance',
        'prestaz',
        'palestra',
        'corsa',
        'ciclismo',
        'nuoto',
        'calcio',
        'tennis',
        'pesi',
        'crossfit',
        'atletica',
        'triathlon',
        'maratona',
        'allenamento',
        'workout',
        'VO2',
        'resistenza',
        'forza',
      ],
    ],
    specialists: ['dietista', 'persona-trainer'],
    urgency: 'media',
  },

  // Psycho-work: anxiety/stress + professional context
  {
    keywords: [
      [
        'ansia',
        'stress',
        'nervo',
        'agitaz',
        'preoccup',
        'teso',
        'paur',
        'attacchi',
        'angoscia',
        'panic',
        'mi sento male',
        'nervoso',
        'agitato',
        'in ansia',
        'molto stressato',
        'troppo stress',
        'non riesco a calmarmi',
        'pensieri ossessivi',
        'iperventil',
      ],
      [
        'lavor',
        'profess',
        'carriera',
        'ufficio',
        'capo',
        'colleghi',
        'azienda',
        'progetto',
        'client',
        'riunion',
        'performance',
        'produttiv',
        'burnout',
        'lavoro mi stanca',
        'ambiente di lavoro',
        'devo consegnare',
        'scadenza',
        'presentazione',
        'colloquio',
      ],
    ],
    specialists: ['psicologo', 'mental-coach'],
    urgency: 'media',
  },

  // Pressure-headache: blood pressure + head symptoms
  {
    keywords: [
      [
        'pressione',
        'ipertens',
        'ipotens',
        'press alta',
        'press bassa',
        'sistolica',
        'diastolica',
        'pressione alta',
        'pressione bassa',
        '140/90',
        'mmhg',
        'monitor pressione',
        'tensiometro',
        'pressione del sangue',
        'iperteso',
      ],
      [
        'testa',
        'cefalea',
        'mal di testa',
        'emicrania',
        'vertigin',
        'giramento',
        'capogir',
        'stordito',
        'annebbiamento',
        'gira la testa',
        'testa pesante',
        'pulsazione alla testa',
        'mal di testa forte',
        'senso di vuoto in testa',
        'svenimento',
        'presincope',
      ],
    ],
    specialists: ['cardiologo', 'mmg'],
    urgency: 'alta',
  },

  // Psycho-relational: emotional distress + relationships
  {
    keywords: [
      [
        'ansia',
        'triste',
        'depress',
        'umore',
        'piango',
        'piangere',
        'emozioni',
        'senso di vuoto',
        'non ce la faccio',
        'stanco di tutto',
        'mi sento solo',
        'umore basso',
        'sento di non valere',
        'sento vuoto',
        'vuoto interiore',
        'senza senso',
        'nessuno mi capisce',
        'mi sento perso',
        'non ho voglia di niente',
        'apatia',
        'demotivato',
      ],
      [
        'relazion',
        'coppia',
        'partner',
        'famiglia',
        'amici',
        'solo',
        'solitudin',
        'separaz',
        'divorzio',
        'conflitt',
        'litigo',
        'liti',
        'non mi capisce',
        'mio partner',
        'mia moglie',
        'mio marito',
        'fidanzato',
        'fidanzata',
        'rapporto',
        'ex',
        'rottura',
        'lasciato',
      ],
    ],
    specialists: ['psicologo', 'relationship-coach'],
    urgency: 'media',
  },

  // Gut-skin axis: skin symptoms + digestive symptoms
  {
    keywords: [
      [
        'pelle',
        'cutane',
        'dermatit',
        'eritema',
        'prurito',
        'rossore',
        'acne',
        'eczema',
        'psoriasi',
        'orticaria',
        'brufoli',
        'sfogo',
        'rash',
        'macchie sulla pelle',
        'allergia cutanea',
        'pelle secca',
        'pelle grassa',
        'pruriginoso',
        'bruciore cutaneo',
      ],
      [
        'intestin',
        'gonfiore',
        'digestione',
        'pancia',
        'colon',
        'stitichez',
        'diarrea',
        'meteorismo',
        'dispepsia',
        'colite',
        'pancia gonfia',
        'bruciore di stomaco',
        'stomaco',
        'reflusso',
        'gastrite',
        'sindrome dell intestino irritabile',
        'ibs',
        'indigestione',
      ],
    ],
    specialists: ['dermatologo', 'gastroenterologo'],
    urgency: 'media',
  },

  // Muscular-athletic: muscle pain + training
  {
    keywords: [
      [
        'muscol',
        'doms',
        'indolenz',
        'crampi',
        'contrattura',
        'stiramento',
        'sovraccarico',
        'affaticamento muscol',
        'muscoli dolenti',
        'muscoli indolenziti',
        'rigidità muscolare',
        'tensione muscolare',
        'spasmo',
        'dolenzia',
        'crampo notturno',
        'muscoli duri',
      ],
      [
        'allena',
        'palestra',
        'sport',
        'corsa',
        'ciclismo',
        'pesi',
        'squat',
        'deadlift',
        'bench',
        'workout',
        'box',
        'crossfit',
        'sessione',
        'dopo l allenamento',
        'post allenamento',
        'recupero sportivo',
        'performance atletica',
        'gara',
        'competizione',
      ],
    ],
    specialists: ['medico-dello-sport', 'persona-trainer'],
    urgency: 'media',
  },

  // Hormonal: cycle/hormones + metabolic/mood symptoms
  {
    keywords: [
      [
        'ciclo',
        'mestrua',
        'irregolare',
        'amenorrea',
        'pms',
        'sindrome premestruale',
        'ovulaz',
        'ovaio',
        'ormoni',
        'cortisolo',
        'progesterone',
        'estrogeni',
        'menopausa',
        'perimenopaus',
        'testosterone',
        'prolattina',
        'tiroide',
        'squilibrio ormonale',
        'analisi ormonali',
        'fase del ciclo',
      ],
      [
        'peso',
        'umore',
        'stanc',
        'gonfiore',
        'ritenzione',
        'dolori addominali',
        'sbalzi',
        'variazioni',
        'cambiamenti',
        'umore sbalzato',
        'ritenz idrica',
        'sbalzi d umore',
        'irritabilità',
        'depressione premestruale',
        'acne ormonale',
        'capelli che cadono',
        'perdita di capelli',
      ],
    ],
    specialists: ['endocrinologo', 'mmg'],
    urgency: 'media',
  },

  // Stress-organizational: overwhelm + time management
  {
    keywords: [
      [
        'stress',
        'sopraffatt',
        'troppo da fare',
        'non riesco a gestire',
        'non ho tempo',
        'sempre di corsa',
        'esaurit',
        'non ce la faccio',
        'sovraccarico',
        'troppe cose',
        'mi sento sopraffatto',
        'tutto insieme',
        'non riesco a stare dietro',
        'non so da dove iniziare',
        'troppi impegni',
        'stracolmo di cose',
      ],
      [
        'organizzaz',
        'tempo',
        'priorità',
        'lavoro',
        'agenda',
        'impegni',
        'produttiv',
        'lista',
        'task',
        'gestire tutto',
        'pianificaz',
        'calendario',
        'scadenze',
        'to do',
        'todo',
        'compiti',
        'progetti',
        'delegare',
        'time management',
        'gestione del tempo',
      ],
    ],
    specialists: ['life-organizer', 'mental-coach'],
    urgency: 'media',
  },
]

export function detectMultiSpecialistNeed(
  message: string,
  team: AgentProfile[],
): { specialists: AgentProfile[]; urgency: 'alta' | 'media' } | null {
  const lower = message.toLowerCase()

  for (const cluster of SYMPTOM_CLUSTER_RULES) {
    // AND inter-group: every keyword group must have at least one match
    const allGroupsMatch = cluster.keywords.every((group) =>
      // OR intra-group: any term matches as substring
      group.some((term) => lower.includes(term.toLowerCase())),
    )

    if (!allGroupsMatch) continue

    // Collect AgentProfile objects for cluster specialists that exist in the team
    const matched = cluster.specialists
      .map((id) => team.find((agent) => agent.id === id))
      .filter((agent): agent is AgentProfile => Boolean(agent))

    if (matched.length > 0) {
      return { specialists: matched, urgency: cluster.urgency }
    }
  }

  return null
}

/** Phrases that signal the user wants to speak with a specific specialist */
const REQUEST_VERBS = [
  'parlami con',
  'parla con',
  'voglio parlare con',
  'voglio parlare al',
  'voglio il',
  'voglio la',
  'passami il',
  'passami la',
  'dammi il',
  'fammi parlare con',
  'connettimi con',
  'vorrei parlare con',
  'vorrei il',
  'speak to',
  'talk to',
  'chiedi al',
]

/** Maps keyword → agent id for specialist detection */
const SPECIALIST_KEYWORDS: Record<string, string> = {
  dietista: 'dietista',
  dietitian: 'dietista',
  nutrizionista: 'dietista',
  chef: 'chef',
  cuoco: 'chef',
  endocrinologo: 'endocrinologo',
  endocrinologa: 'endocrinologo',
  'personal trainer': 'persona-trainer',
  'personal-trainer': 'persona-trainer',
  trainer: 'persona-trainer',
  allenatore: 'persona-trainer',
  chinesologo: 'chinesologo',
  chinesiologia: 'chinesologo',
  'medico dello sport': 'medico-dello-sport',
  'medico sport': 'medico-dello-sport',
  fisioterapista: 'fisioterapista',
  fisiatra: 'fisiatra',
  'sleep coach': 'sleep-coach',
  'coach del sonno': 'sleep-coach',
  mmg: 'mmg',
  'medico di base': 'mmg',
  'medico curante': 'mmg',
  'medico generico': 'mmg',
  gastroenterologo: 'gastroenterologo',
  gastro: 'gastroenterologo',
  cardiologo: 'cardiologo',
  cardiologa: 'cardiologo',
  dermatologo: 'dermatologo',
  dermatologa: 'dermatologo',
  psicologo: 'psicologo',
  psicologa: 'psicologo',
  'mental coach': 'mental-coach',
  'mental-coach': 'mental-coach',
  'coach relazionale': 'relationship-coach',
  'relationship coach': 'relationship-coach',
  'analista contesto': 'analista-contesto',
  'financial planner': 'financial-planner',
  'pianificatore finanziario': 'financial-planner',
  commercialista: 'commercialista',
  'career coach': 'career-coach',
  'coach carriera': 'career-coach',
  'executive coach': 'executive-coach',
  'organizzatore di vita': 'life-organizer',
  'life organizer': 'life-organizer',
  'consulente legale': 'consulente-legale',
  avvocato: 'consulente-legale',
}

const SPECIALIST_EXIT_PATTERNS = [
  /esci\s+dalla\s+modalit[aà]\s+specialista/i,
  /torna\s+al\s+team/i,
  /chiudi\s+specialista/i,
  /basta\s+specialista/i,
]

export function detectSpecialistRequest(message: string, team: AgentProfile[]): string | null {
  const lower = message.toLowerCase()

  for (const [kw, agentId] of Object.entries(SPECIALIST_KEYWORDS)) {
    if (lower.includes(kw) && team.some((agent) => agent.id === agentId)) {
      return agentId
    }
  }

  const hasRequestVerb = REQUEST_VERBS.some((verb) => lower.includes(verb))
  if (!hasRequestVerb) return null

  for (const agent of team) {
    if (lower.includes(agent.displayName.toLowerCase())) return agent.id
  }

  return null
}

export function shouldExitSpecialistMode(message: string): boolean {
  return SPECIALIST_EXIT_PATTERNS.some((pattern) => pattern.test(message))
}

type RoutingCandidateResolution = {
  domainHint: Domain
  selectedAgents: AgentProfile[]
  decisionTrace: DecisionTraceEvent[]
}

export function resolveRoutingCandidates(params: {
  team: AgentProfile[]
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  currentSpeakerId?: string
}): RoutingCandidateResolution {
  const { team, message, detectedDomain, allDomains, currentSpeakerId } = params
  const clusterMatch = detectMultiSpecialistNeed(message, team)
  const domainHint = detectedDomain

  const selectedAgents = currentSpeakerId
    ? (() => {
        const base = selectAgentsForRequest(team, domainHint, 6, allDomains, message).filter(
          (agent) => agent.id !== 'orchestratore',
        )
        const ordered = [
          team.find((agent) => agent.id === currentSpeakerId),
          ...base.filter((agent) => agent.id !== currentSpeakerId),
        ].filter((agent): agent is AgentProfile => Boolean(agent))
        return ordered.slice(0, 3)
      })()
    : clusterMatch
      ? (() => {
          const domainScored = selectAgentsForRequest(team, domainHint, 6, allDomains, message)
          const clusterIds = new Set(clusterMatch.specialists.map((s) => s.id))
          const clusterFirst: AgentProfile[] =
            clusterMatch.urgency === 'alta'
              ? clusterMatch.specialists
              : clusterMatch.specialists.slice(0, 2)
          const fillers = domainScored.filter((a) => !clusterIds.has(a.id))
          return [...clusterFirst, ...fillers].slice(0, 6)
        })()
      : selectAgentsForRequest(team, domainHint, 4, allDomains, message)

  return {
    domainHint,
    selectedAgents,
    decisionTrace: [
      buildAgentsSelectedTraceEvent({
        step: 3,
        domainHint,
        selectedAgentIds: selectedAgents.map((agent) => agent.id),
        collaborationCap: currentSpeakerId ? 3 : clusterMatch ? 6 : 4,
        reason: currentSpeakerId
          ? 'case_state_speaker_first'
          : clusterMatch
            ? `symptom_cluster_routing_urgency_${clusterMatch.urgency}`
            : 'domain_based_selection',
      }),
    ],
  }
}
