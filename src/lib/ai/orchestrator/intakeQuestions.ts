/**
 * intakeQuestions.ts
 *
 * Source of truth for:
 *   - AGENT_INTAKE_KEYS    — required/optional fields per specialist
 *   - FIELD_QUESTIONS      — Italian human-friendly question per field key
 *   - FIELD_PRIMARY_OWNER  — which specialist "naturally" collects shared fields
 *   - getMissingRequiredFields() — returns own-fields and peer-routed fields for a specialist
 *   - getQuestionForField()      — returns the Italian question to ask for a field
 *   - flatAttributeMap()         — flattens all UserAttributes into key→value map
 */

import type { ContextPack } from '../types'

// ---------------------------------------------------------------------------
// AGENT_INTAKE_KEYS — required / optional attribute keys per agent
// ---------------------------------------------------------------------------

export const AGENT_INTAKE_KEYS: Record<string, { required: string[]; optional: string[] }> = {
  dietista: {
    required: ['weight', 'height', 'goal', 'allergy', 'meal_pattern'],
    optional: ['budget_food', 'cooking_time'],
  },
  chef: {
    required: ['goal', 'cooking_experience', 'dietary_restrictions', 'cooking_time'],
    optional: ['equipment'],
  },
  endocrinologo: {
    required: ['weight', 'symptoms', 'sleep_hours', 'medications', 'hormonal_exams'],
    optional: ['recent_weight_change'],
  },
  'persona-trainer': {
    required: ['fitness_level', 'training_frequency_per_week', 'injury', 'goal'],
    optional: ['equipment'],
  },
  chinesologo: {
    required: ['fitness_level', 'goal', 'injury', 'sport'],
    optional: ['body_awareness'],
  },
  fisioterapista: {
    required: [
      'pain_location',
      'pain_cause',
      'symptom_duration',
      'pain_intensity',
      'functional_impact',
    ],
    optional: ['previous_treatments'],
  },
  fisiatra: {
    required: ['diagnosis', 'functional_status', 'pain_location', 'pain_intensity'],
    optional: ['rehab_goal'],
  },
  'medico-dello-sport': {
    required: ['sport', 'training_frequency_per_week', 'injury', 'goal'],
    optional: ['supplements'],
  },
  'coach-del-sonno': {
    required: ['sleep_hours', 'sleep_latency', 'night_wakings', 'sleep_quality'],
    optional: ['evening_routine'],
  },
  mmg: {
    required: ['complaint', 'symptoms', 'blood_pressure', 'medications', 'lifestyle'],
    optional: ['recent_exams'],
  },
  cardiologo: {
    required: ['symptoms', 'blood_pressure', 'family_history', 'medications', 'physical_activity'],
    optional: ['ecg_result', 'cholesterol'],
  },
  dermatologo: {
    required: ['lesion_type', 'lesion_location', 'symptom_duration', 'triggers'],
    optional: ['current_treatment'],
  },
  gastroenterologo: {
    required: ['digestive_symptoms', 'symptom_frequency', 'food_triggers', 'medications'],
    optional: ['recent_exams'],
  },
  psicologo: {
    required: [
      'complaint',
      'relational_context',
      'work_context',
      'symptom_duration',
      'distress_intensity',
    ],
    optional: ['symptoms'],
  },
  'mental-coach': {
    required: ['mental_performance_goal', 'difficulty_area', 'context'],
    optional: ['mental_resources'],
  },
  'relationship-coach': {
    required: ['relationship_type', 'main_problem', 'problem_duration'],
    optional: ['previous_attempts'],
  },
  'analista-contesto': {
    required: ['analysis_domain', 'decision_goal', 'urgency'],
    optional: ['available_data'],
  },
  'career-coach': {
    required: ['current_role', 'professional_goal', 'main_obstacle', 'timeline'],
    optional: [],
  },
  'executive-coach': {
    required: ['leadership_role', 'team_context', 'main_challenge', 'professional_goal'],
    optional: [],
  },
  commercialista: {
    required: ['activity_type', 'tax_regime', 'fiscal_situation', 'upcoming_deadlines'],
    optional: [],
  },
  'consulente-legale': {
    required: ['legal_issue_type', 'case_status', 'objective', 'urgency'],
    optional: ['documentation'],
  },
  'financial-planner': {
    required: ['income_range', 'expenses', 'savings', 'financial_goal', 'risk_tolerance'],
    optional: ['debts'],
  },
  'life-organizer': {
    required: ['difficulty_area', 'organizational_goal', 'constraints'],
    optional: ['current_tools'],
  },
}

// ---------------------------------------------------------------------------
// FIELD_QUESTIONS — Italian question per field key
// Agent-specific overrides can go in AGENT_FIELD_OVERRIDES below.
// ---------------------------------------------------------------------------

const FIELD_QUESTIONS: Record<string, string> = {
  // Biometric
  weight: 'Qual è il tuo peso attuale in kg?',
  height: 'Qual è la tua altezza in cm?',

  // Nutrition / dietista
  goal: 'Qual è il tuo obiettivo principale in questo momento?',
  allergy: 'Hai allergie o intolleranze alimentari da tenere in considerazione?',
  meal_pattern:
    'Come si distribuiscono i tuoi pasti nella giornata (colazione, pranzo, cena, spuntini)?',
  budget_food: 'Hai un budget settimanale indicativo per la spesa alimentare?',
  cooking_time: 'Quanto tempo puoi dedicare alla preparazione dei pasti ogni giorno?',

  // Chef
  cooking_experience: 'Come descriveresti il tuo livello di esperienza in cucina?',
  dietary_restrictions: 'Hai restrizioni dietetiche o preferenze alimentari specifiche?',
  equipment: 'Quali attrezzature da cucina hai a disposizione?',

  // Endocrinologo
  symptoms: 'Quali sintomi stai riscontrando attualmente?',
  sleep_hours: 'Quante ore dormi mediamente per notte?',
  medications: 'Stai assumendo farmaci o integratori? Se sì, quali?',
  hormonal_exams:
    'Hai eseguito di recente analisi ormonali (es. TSH, cortisolo, insulina)? Puoi condividere i valori?',
  recent_weight_change: "Hai notato variazioni di peso significative nell'ultimo mese?",

  // Personal trainer / Chinesologo
  fitness_level: 'Come descriveresti il tuo livello di forma fisica attuale?',
  training_frequency_per_week: 'Quanti allenamenti riesci a fare a settimana realisticamente?',
  injury: 'Hai infortuni o limitazioni fisiche attive da considerare nel piano?',
  body_awareness: 'Come descriveresti la tua consapevolezza corporea e il controllo del movimento?',
  sport: 'Pratichi sport o attività fisica regolare? Quale e con quale frequenza?',

  // Fisioterapista / Fisiatra
  pain_location: 'Dove si localizza esattamente il dolore o il problema fisico?',
  pain_cause: 'Hai idea di cosa abbia causato il problema (infortunio, sforzo, postura, trauma)?',
  symptom_duration: 'Da quanto tempo è presente questo problema o sintomo?',
  pain_intensity: 'Su una scala da 1 a 10, quanto è intenso il dolore nella quotidianità?',
  functional_impact:
    'Quali attività quotidiane risultano limitate o difficili per via di questo problema?',
  previous_treatments:
    'Hai già seguito trattamenti (fisioterapia, farmaci, interventi) per questo problema?',
  diagnosis: 'Hai già ricevuto una diagnosi medica confermata per questo problema?',
  functional_status:
    'Riesci a svolgere le normali attività quotidiane o hai limitazioni importanti?',
  rehab_goal:
    'Qual è il tuo obiettivo riabilitativo principale (tornare a praticare sport, eliminare il dolore, ecc.)?',

  // Medico dello sport
  supplements: 'Assumi integratori o prodotti specifici per lo sport?',

  // Coach del sonno
  sleep_latency: 'Quanto tempo impieghi mediamente ad addormentarti una volta a letto?',
  night_wakings:
    'Ti svegli durante la notte? Se sì, quante volte e riesci a riaddormentarti facilmente?',
  sleep_quality: 'Su una scala da 1 a 10, come valuti la qualità del tuo sonno?',
  evening_routine: 'Hai una routine serale prima di andare a letto?',

  // MMG
  complaint: 'Qual è il motivo principale per cui cerchi supporto oggi?',
  blood_pressure: 'Conosci i tuoi valori abituali di pressione arteriosa?',
  lifestyle:
    'Come descriveresti il tuo stile di vita (fumo, alcol, attività fisica, alimentazione generale)?',
  recent_exams:
    'Hai eseguito esami del sangue o altri accertamenti di recente? Puoi condividere qualche valore?',

  // Cardiologo
  family_history: 'Ci sono casi di malattie cardiovascolari, diabete o ipertensione in famiglia?',
  physical_activity: 'Che tipo di attività fisica svolgi regolarmente e con quale intensità?',
  ecg_result: 'Hai eseguito di recente un ECG o altri esami cardiologici?',
  cholesterol: 'Conosci i tuoi valori di colesterolo totale, LDL e HDL?',

  // Dermatologo
  lesion_type:
    'Come descriveresti il problema cutaneo (rossore, prurito, macchie, brufoli, sfogo)?',
  lesion_location: 'In quale zona del corpo si trova il problema sulla pelle?',
  triggers:
    'Hai notato fattori che scatenano o peggiorano il problema (cibo, stress, prodotti, ecc.)?',
  current_treatment: 'Stai usando creme, farmaci o altri trattamenti per il problema cutaneo?',

  // Gastroenterologo
  digestive_symptoms:
    'Quali sintomi digestivi stai riscontrando (gonfiore, dolori addominali, nausea, alterazioni intestinali)?',
  symptom_frequency:
    'Con quale frequenza si presentano questi sintomi (quotidianamente, settimanalmente)?',
  food_triggers: 'Hai notato alimenti o bevande che scatenano o peggiorano i sintomi?',

  // Psicologo
  relational_context:
    'Come descriveresti la qualità delle tue relazioni principali (partner, famiglia, amici)?',
  work_context: 'Come ti senti nel contesto lavorativo o di studio?',
  distress_intensity: 'Su una scala da 1 a 10, quanto stai soffrendo per questa situazione?',

  // Mental coach
  mental_performance_goal: 'Qual è il tuo obiettivo di performance mentale che vuoi raggiungere?',
  difficulty_area:
    'In quale area specifica stai riscontrando difficoltà (concentrazione, motivazione, gestione dello stress)?',
  context:
    'In quale contesto si manifestano principalmente queste difficoltà (sport, lavoro, studio)?',
  mental_resources: 'Quali risorse o punti di forza mentali riconosci in te stesso?',

  // Relationship coach
  relationship_type: 'Di che tipo di relazione si tratta (coppia, famiglia, lavoro, amicizia)?',
  main_problem: 'Qual è il problema principale che stai vivendo in questa relazione?',
  problem_duration: 'Da quanto tempo è presente questa difficoltà relazionale?',
  previous_attempts: 'Hai già provato a risolvere questa situazione? Come è andata?',

  // Analista contesto
  analysis_domain:
    'Quale ambito vuoi analizzare (business, decisione personale, strategia, scenario futuro)?',
  decision_goal: "Qual è la decisione o l'obiettivo che stai cercando di raggiungere?",
  urgency: "C'è un'urgenza temporale: entro quando ti serve una risposta o una decisione?",
  available_data: "Hai dati, documenti o informazioni da condividere per approfondire l'analisi?",

  // Career coach
  current_role: 'Qual è il tuo ruolo professionale attuale?',
  professional_goal: 'Qual è il tuo obiettivo professionale principale?',
  main_obstacle: 'Qual è il principale ostacolo che senti nel tuo percorso professionale?',
  timeline: 'Entro quanto tempo vorresti raggiungere questo obiettivo?',

  // Executive coach
  leadership_role: 'Qual è il tuo ruolo di leadership (CEO, direttore, manager, team lead)?',
  team_context: 'Come descriveresti il contesto del tuo team (dimensione, settore, sfide attuali)?',
  main_challenge: 'Qual è la principale sfida che stai affrontando come leader in questo momento?',

  // Commercialista
  activity_type:
    'Che tipo di attività svolgi (ditta individuale, SRL, libero professionista, altro)?',
  tax_regime: 'Qual è il tuo regime fiscale attuale (forfettario, ordinario, semplificato)?',
  fiscal_situation:
    'Come descriveresti la tua situazione fiscale attuale (in regola, con pendenze, in fase di avvio)?',
  upcoming_deadlines: 'Hai scadenze fiscali imminenti da tenere in considerazione?',

  // Consulente legale
  legal_issue_type:
    'Di che tipo di questione legale si tratta (contrattuale, penale, civile, lavoro, famiglia)?',
  case_status:
    'A che punto è la situazione (pre-contenzioso, in corso, sentenza, accordo extragiudiziale)?',
  objective: 'Qual è il tuo obiettivo principale (tutela, accordo, risarcimento, chiarimento)?',
  documentation: 'Hai documenti rilevanti (contratti, comunicazioni, atti) da condividere?',

  // Financial planner
  income_range: 'Qual è il tuo range di reddito mensile netto indicativo?',
  expenses:
    'Quali sono le tue principali categorie di spesa mensile (affitto, mutuo, spese ricorrenti)?',
  savings: 'Hai risparmi o investimenti attualmente? Puoi indicare un ordine di grandezza?',
  financial_goal:
    'Qual è il tuo obiettivo finanziario principale (pensione, acquisto casa, emergenze, crescita)?',
  risk_tolerance:
    'Come ti definiresti rispetto al rischio finanziario (conservativo, moderato, aggressivo)?',
  debts: 'Hai debiti o finanziamenti in corso da considerare nella pianificazione?',

  // Life organizer (difficulty_area uses AGENT_FIELD_OVERRIDES for life-organizer specificity)
  organizational_goal:
    'Cosa vorresti migliorare concretamente nella tua organizzazione quotidiana?',
  constraints: 'Quali sono i principali vincoli (tempo, risorse, impegni fissi) da rispettare?',
  current_tools: 'Usi già strumenti di organizzazione (agenda, app, liste)? Come ti trovi?',
}

// Agent-specific question overrides for fields shared across specialists
const AGENT_FIELD_OVERRIDES: Record<string, Record<string, string>> = {
  dietista: {
    goal: 'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
    allergy: 'Hai allergie o intolleranze alimentari da registrare?',
    meal_pattern: 'Come si distribuiscono i tuoi pasti nella giornata?',
  },
  endocrinologo: {
    goal: 'Qual è il tuo obiettivo principale rispetto alla salute ormonale o metabolica?',
    symptoms:
      'Quali sintomi ormonali o metabolici stai riscontrando (stanchezza, variazioni di peso, irregolarità del ciclo, ecc.)?',
  },
  cardiologo: {
    symptoms:
      'Quali sintomi cardiovascolari stai riscontrando (palpitazioni, fiato corto, dolore toracico, vertigini)?',
    goal: 'Qual è il tuo obiettivo rispetto alla salute cardiovascolare?',
  },
  psicologo: {
    complaint: 'Cosa ti ha spinto a cercare supporto psicologico?',
    symptom_duration: 'Da quanto tempo stai attraversando questa difficoltà emotiva o psicologica?',
  },
  mmg: {
    complaint: 'Qual è il motivo principale della tua richiesta oggi?',
    symptom_duration: 'Da quanto tempo sono presenti questi sintomi?',
  },
  'career-coach': {
    goal: 'Qual è il tuo obiettivo professionale a lungo termine?',
  },
  'executive-coach': {
    professional_goal: 'Qual è il tuo obiettivo di sviluppo come leader?',
  },
  'life-organizer': {
    difficulty_area:
      'In quale area hai più difficoltà organizzative (lavoro, casa, tempo, relazioni, salute)?',
  },
}

// ---------------------------------------------------------------------------
// FIELD_PRIMARY_OWNER — which specialist primarily collects shared fields
// Fields NOT in this map are "owned" by whoever requires them (ask directly).
// ---------------------------------------------------------------------------

export const FIELD_PRIMARY_OWNER: Record<string, string> = {
  // Biometric — dietista owns general measurements
  weight: 'dietista',
  height: 'dietista',

  // Sleep — coach-del-sonno owns all sleep data
  sleep_hours: 'coach-del-sonno',
  sleep_latency: 'coach-del-sonno',
  night_wakings: 'coach-del-sonno',
  sleep_quality: 'coach-del-sonno',

  // General health — mmg owns general complaints and medications
  medications: 'mmg',
  symptoms: 'mmg',
  complaint: 'mmg',
  blood_pressure: 'cardiologo',
  symptom_duration: 'mmg',
  lifestyle: 'mmg',

  // Physical fitness — persona-trainer owns fitness/training data
  fitness_level: 'persona-trainer',
  training_frequency_per_week: 'persona-trainer',
  physical_activity: 'persona-trainer',

  // Sport / injury — medico-dello-sport owns sport-specific
  sport: 'medico-dello-sport',
  injury: 'medico-dello-sport',

  // Pain — fisioterapista owns pain assessment
  pain_location: 'fisioterapista',
  pain_intensity: 'fisioterapista',
}

// ---------------------------------------------------------------------------
// flatAttributeMap — flatten all UserAttributes into key → display string
// ---------------------------------------------------------------------------

/**
 * F1: Profile→Attribute mapping — UserProfile fields that agents need as intake data.
 * These are merged as low-priority defaults; attributes from `user.attributes` always
 * override them (the user may have updated via chat after the profile was saved).
 */
const PROFILE_TO_ATTRIBUTE: Array<{ key: string; profileKey: string; unit?: string }> = [
  { key: 'weight', profileKey: 'weight', unit: 'kg' },
  { key: 'height', profileKey: 'height', unit: 'cm' },
  { key: 'gender', profileKey: 'gender' },
  { key: 'birthDate', profileKey: 'birthDate' },
  { key: 'goal', profileKey: 'goal' },
]

export function flatAttributeMap(
  attrs: Record<string, Record<string, { value: unknown; unit?: string }>> | undefined,
  /** F1: Optional UserProfile — fields are merged as low-priority defaults. */
  profile?: Record<string, unknown>,
): Map<string, string> {
  const map = new Map<string, string>()

  // F1: Seed the map with UserProfile data (lower priority — attributes override below).
  if (profile) {
    for (const { key, profileKey, unit } of PROFILE_TO_ATTRIBUTE) {
      const val = profile[profileKey]
      if (val != null && val !== '') {
        map.set(key, String(val) + (unit ? ` ${unit}` : ''))
      }
    }
  }

  if (!attrs) return map
  // Overlay with UserAttribute values (higher priority — chat-collected data wins).
  for (const domainValues of Object.values(attrs)) {
    if (!domainValues || typeof domainValues !== 'object') continue
    for (const [k, v] of Object.entries(
      domainValues as Record<string, { value: unknown; unit?: string }>,
    )) {
      if (v?.value != null) {
        const display = typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)
        map.set(k, display + (v.unit ? ` ${v.unit}` : ''))
      }
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// getQuestionForField — Italian question to ask for a given field
// ---------------------------------------------------------------------------

export function getQuestionForField(agentId: string, fieldKey: string): string {
  const override = AGENT_FIELD_OVERRIDES[agentId]?.[fieldKey]
  if (override) return override
  return FIELD_QUESTIONS[fieldKey] ?? `Puoi fornirmi informazioni su "${fieldKey}"?`
}

// ---------------------------------------------------------------------------
// getMissingRequiredFields — split missing fields into own vs peer-routed
// ---------------------------------------------------------------------------

export type MissingFieldsResult = {
  /** Fields to ask directly (this specialist is the primary owner, or no owner defined) */
  ownFields: string[]
  /** Fields to route to peer specialists */
  peerFields: Array<{ agentId: string; fields: string[] }>
}

export function getMissingRequiredFields(
  agentId: string,
  contextPack: ContextPack,
  teamAgentIds?: string[],
): MissingFieldsResult {
  const intakeKeys = AGENT_INTAKE_KEYS[agentId]
  if (!intakeKeys) return { ownFields: [], peerFields: [] }

  // F1: Include UserProfile data so weight/height/gender from profile are recognized.
  const attrMap = flatAttributeMap(
    contextPack.user.attributes as
      | Record<string, Record<string, { value: unknown; unit?: string }>>
      | undefined,
    contextPack.user.profile as Record<string, unknown> | undefined,
  )

  const ownFields: string[] = []
  const peerMap = new Map<string, string[]>()

  for (const field of intakeKeys.required) {
    // Skip if already present
    if (attrMap.has(field)) continue

    const primaryOwner = FIELD_PRIMARY_OWNER[field]

    // No ownership defined → ask directly
    if (!primaryOwner) {
      ownFields.push(field)
      continue
    }

    // This specialist IS the primary owner → ask directly
    if (primaryOwner === agentId) {
      ownFields.push(field)
      continue
    }

    // Peer specialist is the owner
    // Only route to peer if they're actually in the team
    if (teamAgentIds && !teamAgentIds.includes(primaryOwner)) {
      // Peer not available → ask directly
      ownFields.push(field)
      continue
    }

    const existing = peerMap.get(primaryOwner) ?? []
    existing.push(field)
    peerMap.set(primaryOwner, existing)
  }

  const peerFields = Array.from(peerMap.entries()).map(([peerId, fields]) => ({
    agentId: peerId,
    fields,
  }))

  return { ownFields, peerFields }
}
