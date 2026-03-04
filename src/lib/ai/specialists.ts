import type { SpecialistId, Domain } from './types'

export interface SpecialistDefinition {
  id: SpecialistId
  name: string
  nameIt: string
  emoji: string
  domains: Domain[]
  keywords: string[]
  promptFile: string
  description: string
}

/**
 * All specialist definitions with routing metadata.
 * Keywords are used for rule-based routing (STEP 7).
 * In STEP 8, Gemini will handle intent classification.
 */
export const specialists: SpecialistDefinition[] = [
  {
    id: 'intervistatore',
    name: 'Interviewer',
    nameIt: 'Intervistatore',
    emoji: '🎙️',
    domains: ['generale'],
    keywords: [],
    promptFile: 'INTERVISTATORE.md',
    description: 'Raccoglie le informazioni minime necessarie (MVD) tramite intervista naturale',
  },
  {
    id: 'dietista',
    name: 'Dietitian',
    nameIt: 'Dietista',
    emoji: '🥗',
    domains: ['nutrizione'],
    keywords: [
      'dieta', 'calorie', 'macronutrienti', 'proteine', 'carboidrati', 'grassi',
      'alimentazione', 'nutrizione', 'peso', 'dimagrire', 'ingrassare', 'pasto',
      'colazione', 'pranzo', 'cena', 'spuntino', 'integratore', 'vitamine',
      'minerali', 'fibra', 'idratazione', 'acqua', 'metabolismo', 'insulina',
      'glicemia', 'allergia', 'intolleranza', 'celiachia', 'lattosio', 'vegano',
      'vegetariano', 'fabbisogno', 'kcal', 'bmi', 'massa grassa', 'massa magra',
    ],
    promptFile: 'DIETISTA.md',
    description: 'Valutazione nutrizionale, piani alimentari, nutrizione clinica',
  },
  {
    id: 'personal_trainer',
    name: 'Personal Trainer',
    nameIt: 'Personal Trainer',
    emoji: '💪',
    domains: ['allenamento'],
    keywords: [
      'allenamento', 'esercizio', 'palestra', 'workout', 'cardio', 'forza',
      'resistenza', 'muscolo', 'muscoli', 'squat', 'panca', 'deadlift',
      'corsa', 'running', 'nuoto', 'ciclismo', 'hiit', 'crossfit', 'yoga',
      'stretching', 'riscaldamento', 'ripetizioni', 'serie', 'set', 'rep',
      'volume', 'intensità', 'frequenza', 'split', 'full body', 'upper',
      'lower', 'push', 'pull', 'legs', 'recupero', 'overtraining', 'pr',
      'personal record', 'progressione', 'periodizzazione', 'ipertrofia',
    ],
    promptFile: 'PERSONA TRAINER.md',
    description: 'Programmazione fitness, prescrizione esercizi, performance',
  },
  {
    id: 'psicologo',
    name: 'Psychologist',
    nameIt: 'Psicologo',
    emoji: '🧠',
    domains: ['mindset'],
    keywords: [
      'ansia', 'stress', 'depressione', 'panico', 'attacco', 'paura',
      'fobia', 'trauma', 'autostima', 'insicurezza', 'relazione',
      'conflitto', 'lutto', 'perdita', 'sonno', 'insonnia', 'ossessione',
      'compulsione', 'disturbo', 'terapia', 'psicoterapia', 'emozione',
      'rabbia', 'tristezza', 'piangere', 'solitudine', 'isolamento',
    ],
    promptFile: 'PSICOLOGO.md',
    description: 'Supporto psicologico clinico, assessment, interventi',
  },
  {
    id: 'mental_coach',
    name: 'Mental Coach',
    nameIt: 'Mental Coach',
    emoji: '🎯',
    domains: ['mindset'],
    keywords: [
      'motivazione', 'obiettivo', 'abitudine', 'disciplina', 'focus',
      'produttività', 'procrastinare', 'procrastinazione', 'mindset',
      'resilienza', 'mentalità', 'crescita', 'performance', 'routine',
      'mattina', 'sera', 'meditazione', 'mindfulness', 'consapevolezza',
      'concentrazione', 'energia', 'burnout', 'equilibrio', 'work-life',
    ],
    promptFile: 'MENTAL COACH.md',
    description: 'Performance non-clinica, abitudini, resilienza, comunicazione',
  },
  {
    id: 'chef',
    name: 'Chef',
    nameIt: 'Chef',
    emoji: '👨‍🍳',
    domains: ['cucina'],
    keywords: [
      'ricetta', 'cucinare', 'cucina', 'preparare', 'ingrediente',
      'cottura', 'forno', 'padella', 'pentola', 'meal prep', 'piatto',
      'condimento', 'spezia', 'salsa', 'contorno', 'primo', 'secondo',
      'dolce', 'dessert', 'snack', 'frullato', 'smoothie', 'insalata',
    ],
    promptFile: 'CHEF.md',
    description: 'Guida culinaria, meal prep, ottimizzazione ricette',
  },
  {
    id: 'fisioterapista',
    name: 'Physiotherapist',
    nameIt: 'Fisioterapista',
    emoji: '🦴',
    domains: ['riabilitazione'],
    keywords: [
      'dolore', 'mal di schiena', 'cervicale', 'lombare', 'ginocchio',
      'spalla', 'caviglia', 'polso', 'gomito', 'anca', 'riabilitazione',
      'fisioterapia', 'mobilità', 'flessibilità', 'postura', 'ernia',
      'tendinite', 'stiramento', 'strappo', 'contrattura', 'fascite',
    ],
    promptFile: 'FISIOTERAPISTA.md',
    description: 'Riabilitazione, mobilità, recupero funzionale',
  },
  {
    id: 'fisiatra',
    name: 'Physiatrist',
    nameIt: 'Fisiatra',
    emoji: '⚕️',
    domains: ['riabilitazione', 'salute'],
    keywords: [
      'visita', 'diagnosi', 'esame', 'radiografia', 'risonanza', 'ecografia',
      'ortopedico', 'fisiatra', 'specialista', 'farmaco', 'terapia fisica',
    ],
    promptFile: 'FISIATRA.md',
    description: 'Coordinamento medicina fisica e riabilitativa',
  },
  {
    id: 'medico_sport',
    name: 'Sports Medicine Doctor',
    nameIt: 'Medico dello Sport',
    emoji: '🏅',
    domains: ['salute', 'allenamento'],
    keywords: [
      'infortunio sportivo', 'certificato medico', 'idoneità', 'doping',
      'sovrallenamento', 'cuore', 'frequenza cardiaca', 'vo2max',
      'lattato', 'soglia', 'performance atletica', 'agonismo',
    ],
    promptFile: 'MEDICO DELLO SPORT.md',
    description: 'Valutazione medico-sportiva, performance atletica',
  },
  {
    id: 'mmg',
    name: 'General Practitioner',
    nameIt: 'Medico di Medicina Generale',
    emoji: '🩺',
    domains: ['salute'],
    keywords: [
      'medico', 'dottore', 'febbre', 'influenza', 'raffreddore', 'tosse',
      'pressione', 'colesterolo', 'glicemia', 'esami sangue', 'analisi',
      'farmaco', 'ricetta', 'vaccino', 'malattia', 'sintomo', 'cronico',
    ],
    promptFile: 'MMG.md',
    description: 'Coordinamento cure primarie',
  },
  {
    id: 'gastroenterologo',
    name: 'Gastroenterologist',
    nameIt: 'Gastroenterologo',
    emoji: '🫁',
    domains: ['salute', 'nutrizione'],
    keywords: [
      'stomaco', 'intestino', 'digestione', 'reflusso', 'gastrite',
      'colite', 'colon', 'irritabile', 'gonfiore', 'meteorismo',
      'diarrea', 'stipsi', 'stitichezza', 'nausea', 'vomito', 'crohn',
    ],
    promptFile: 'GASTROENTEROLOGO.md',
    description: 'Consulenza specialistica gastrointestinale',
  },
  {
    id: 'chinesologo',
    name: 'Kinesiologist',
    nameIt: 'Chinesologo',
    emoji: '🤸',
    domains: ['allenamento', 'riabilitazione'],
    keywords: [
      'movimento', 'biomeccanica', 'postura', 'equilibrio', 'coordinazione',
      'propriocezione', 'catena cinetica', 'analisi movimento', 'gesto atletico',
    ],
    promptFile: 'CHINESOLOGO.md',
    description: 'Analisi del movimento',
  },
  {
    id: 'analista_contesto',
    name: 'Context Analyst',
    nameIt: 'Analista del Contesto',
    emoji: '🔍',
    domains: ['generale'],
    keywords: [],
    promptFile: 'ANALISTA CONTESTO.md',
    description: 'Comprensione del contesto utente',
  },
]

/** Map specialist ID to definition */
export const specialistMap = new Map(specialists.map((s) => [s.id, s]))

/** Get specialist by ID */
export function getSpecialist(id: SpecialistId): SpecialistDefinition | undefined {
  return specialistMap.get(id)
}
