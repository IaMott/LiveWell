/**
 * intakeQuestions.ts
 *
 * Source of truth for:
 *   - AGENT_INTAKE_KEYS    — required/optional fields per specialist
 *   - FIELD_PRIMARY_OWNER  — which specialist "naturally" collects shared fields
 *   - getMissingRequiredFields() — returns own-fields and peer-routed fields for a specialist
 *   - flatAttributeMap()         — flattens all UserAttributes into key→value map
 */

import type { ContextPack } from '../types'

// ---------------------------------------------------------------------------
// AGENT_INTAKE_KEYS — required / optional attribute keys per agent
// ---------------------------------------------------------------------------

export const AGENT_INTAKE_KEYS: Record<string, { required: string[]; optional: string[] }> = {
  dietista: {
    required: [
      'birth_date',
      'weight',
      'height',
      'goal',
      'allergy',
      'meal_pattern',
      'physical_activity_level',
      'macro_carbs_g',
      'macro_protein_g',
      'macro_fat_g',
      'calorie_target',
    ],
    optional: [
      'chronic_conditions',
      'smoking_status',
      'alcohol_consumption',
      'medications_current',
      'food_intolerances',
      'budget_food',
      'cooking_time',
    ],
  },
  'biologo-nutrizionista': {
    required: ['birth_date', 'weight', 'height', 'goal', 'allergy', 'meal_pattern', 'blood_type'],
    optional: [
      'chronic_conditions',
      'medications_current',
      'physical_activity_level',
      'macro_carbs_g',
      'macro_protein_g',
      'macro_fat_g',
      'calorie_target',
      'food_intolerances',
      'supplements_current',
      'functional_goal',
      'lab_results_nutrition',
    ],
  },
  dietologo: {
    required: ['weight', 'height', 'goal', 'allergy', 'metabolic_condition', 'medications'],
    optional: ['recent_exams', 'family_history_metabolic'],
  },
  chef: {
    required: ['goal', 'cooking_experience', 'dietary_restrictions', 'cooking_time'],
    optional: ['equipment'],
  },
  endocrinologo: {
    required: ['birth_date', 'weight', 'symptoms', 'sleep_hours', 'medications', 'hormonal_exams'],
    optional: [
      'chronic_conditions',
      'medications_current',
      'physical_activity_level',
      'smoking_status',
      'alcohol_consumption',
      'blood_type',
      'family_medical_history',
      'sleep_quality',
      'stress_level',
      'recent_weight_change',
    ],
  },
  'persona-trainer': {
    required: [
      'birth_date',
      'fitness_level',
      'training_frequency_per_week',
      'injury',
      'goal',
      'resting_heart_rate',
      'previous_injuries_history',
    ],
    optional: ['macro_carbs_g', 'macro_protein_g', 'macro_fat_g', 'calorie_target', 'equipment'],
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
    required: ['birth_date', 'diagnosis', 'functional_status', 'pain_location', 'pain_intensity'],
    optional: [
      'chronic_conditions',
      'resting_heart_rate',
      'previous_injuries_history',
      'rehab_goal',
    ],
  },
  'medico-dello-sport': {
    required: ['sport', 'training_frequency_per_week', 'injury', 'goal'],
    optional: ['supplements'],
  },
  'sleep-coach': {
    required: ['sleep_hours', 'sleep_latency', 'night_wakings', 'sleep_quality', 'stress_level'],
    optional: ['birth_date', 'mental_health_history_brief', 'evening_routine'],
  },
  mmg: {
    required: [
      'birth_date',
      'blood_type',
      'complaint',
      'symptoms',
      'blood_pressure',
      'medications',
      'chronic_conditions',
      'medications_current',
      'smoking_status',
      'alcohol_consumption',
      'lifestyle',
    ],
    optional: [
      'physical_activity_level',
      'sleep_quality',
      'stress_level',
      'family_medical_history',
      'recent_exams',
    ],
  },
  cardiologo: {
    required: [
      'birth_date',
      'smoking_status',
      'symptoms',
      'blood_pressure',
      'family_history',
      'medications',
      'physical_activity',
    ],
    optional: [
      'blood_type',
      'chronic_conditions',
      'medications_current',
      'physical_activity_level',
      'resting_heart_rate',
      'sleep_quality',
      'stress_level',
      'family_medical_history',
      'ecg_result',
      'cholesterol',
    ],
  },
  dermatologo: {
    required: ['birth_date', 'lesion_type', 'lesion_location', 'symptom_duration', 'triggers'],
    optional: ['chronic_conditions', 'current_treatment'],
  },
  gastroenterologo: {
    required: [
      'birth_date',
      'digestive_symptoms',
      'symptom_frequency',
      'food_triggers',
      'medications',
      'chronic_conditions',
    ],
    optional: [
      'medications_current',
      'smoking_status',
      'alcohol_consumption',
      'food_intolerances',
      'recent_exams',
    ],
  },
  reumatologo: {
    required: [
      'birth_date',
      'joint_pain_location',
      'joint_stiffness_duration',
      'symptom_duration',
      'autoimmune_markers',
      'medications',
      'chronic_conditions',
    ],
    optional: ['medications_current', 'family_history_autoimmune', 'previous_treatments'],
  },
  psichiatra: {
    required: [
      'complaint',
      'symptom_duration',
      'distress_intensity',
      'psychiatric_history',
      'medications',
      'mental_health_history_brief',
    ],
    optional: ['family_history_mental', 'substance_use'],
  },
  psicologo: {
    required: [
      'complaint',
      'relational_context',
      'work_context',
      'symptom_duration',
      'distress_intensity',
      'mental_health_history_brief',
    ],
    optional: ['birth_date', 'sleep_quality', 'stress_level', 'symptoms'],
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
    optional: [
      'birth_date',
      'mental_health_history_brief',
      'sleep_quality',
      'stress_level',
      'current_tools',
    ],
  },
  // ── Nuovi specialisti ──────────────────────────────────────────────────────
  neurologo: {
    required: [
      'birth_date',
      'neurological_complaint',
      'symptom_duration',
      'pain_location',
      'pain_intensity',
      'associated_symptoms',
    ],
    optional: [
      'chronic_conditions',
      'medications_current',
      'family_medical_history',
      'previous_neurological_diagnosis',
      'medications',
      'family_history_neurological',
    ],
  },
  ortopedico: {
    required: [
      'birth_date',
      'musculoskeletal_complaint',
      'injury_mechanism',
      'pain_location',
      'pain_intensity',
      'functional_impact',
    ],
    optional: [
      'chronic_conditions',
      'previous_injuries_history',
      'previous_imaging',
      'previous_treatments',
      'physical_activity',
    ],
  },
  urologo: {
    required: [
      'birth_date',
      'urological_complaint',
      'symptom_duration',
      'urinary_frequency',
      'medications',
    ],
    optional: ['chronic_conditions', 'previous_urological_exams', 'prostate_history'],
  },
  oculista: {
    required: [
      'birth_date',
      'visual_complaint',
      'symptom_onset',
      'current_correction',
      'last_eye_exam',
    ],
    optional: ['family_history_ocular', 'systemic_diseases'],
  },
  otorinolaringoiatra: {
    required: ['birth_date', 'ent_complaint', 'symptom_duration', 'associated_symptoms'],
    optional: ['allergies', 'previous_ent_treatments', 'smoking_status'],
  },
  pneumologo: {
    required: [
      'birth_date',
      'respiratory_complaint',
      'symptom_duration',
      'dyspnea_on_exertion',
      'smoking_status',
    ],
    optional: [
      'chronic_conditions',
      'medications_current',
      'spirometry_results',
      'allergies',
      'occupational_exposure',
    ],
  },

  ginecologo: {
    required: [
      'birth_date',
      'gynecological_complaint',
      'menstrual_cycle',
      'last_period',
      'contraception',
    ],
    optional: [
      'blood_type',
      'chronic_conditions',
      'medications_current',
      'physical_activity_level',
      'gynecological_history',
      'obstetric_history',
      'last_pap_test',
      'hormonal_therapy',
    ],
  },

  diabetologo: {
    required: ['diabetes_type', 'glycemia_fasting', 'hba1c', 'diabetes_medications'],
    optional: ['cgm_use', 'hypoglycemia_episodes', 'diabetic_complications', 'diet_adherence'],
  },

  infettivologo: {
    required: ['infectious_complaint', 'fever_duration', 'immunological_status', 'recent_travel'],
    optional: ['chronic_infections', 'recent_antibiotics', 'vaccination_status'],
  },

  oncologo: {
    required: [
      'birth_date',
      'oncological_diagnosis',
      'oncology_current_treatment',
      'oncology_treatment_phase',
      'oncology_performance_status',
    ],
    optional: [
      'blood_type',
      'chronic_conditions',
      'medications_current',
      'smoking_status',
      'alcohol_consumption',
      'family_medical_history',
      'side_effects_current',
      'last_oncology_visit',
      'nutritional_status_oncology',
      'pain_level_oncology',
    ],
  },

  allergologo: {
    required: ['allergic_complaint', 'known_allergens', 'reaction_type', 'symptom_triggers'],
    optional: ['allergy_tests_done', 'emergency_medications', 'immunotherapy_history'],
  },

  geriatra: {
    required: ['birth_date', 'geriatric_complaint', 'polypharmacy', 'functional_autonomy'],
    optional: [
      'chronic_conditions',
      'medications_current',
      'cognitive_screening',
      'fall_history',
      'nutritional_status_elderly',
      'caregiver_support',
    ],
  },
  // ── New specialists ────────────────────────────────────────────────────────
  psicoterapeuta: {
    required: [
      'complaint',
      'symptom_duration',
      'distress_intensity',
      'mental_health_history_brief',
      'relational_context',
    ],
    optional: ['birth_date', 'sleep_quality', 'stress_level', 'medications'],
  },
  'nutrizionista-sportivo': {
    required: ['birth_date', 'weight', 'height', 'goal', 'training_frequency_per_week', 'sport'],
    optional: [
      'macro_carbs_g',
      'macro_protein_g',
      'macro_fat_g',
      'calorie_target',
      'resting_heart_rate',
      'previous_injuries_history',
      'allergy',
      'supplements_current',
    ],
  },
  immunologo: {
    required: [
      'birth_date',
      'complaint',
      'symptom_duration',
      'immunological_status',
      'chronic_conditions',
    ],
    optional: ['blood_type', 'medications_current', 'family_medical_history', 'recent_exams'],
  },
  'chirurgo-bariatrico': {
    required: ['birth_date', 'weight', 'height', 'chronic_conditions', 'medications_current'],
    optional: [
      'blood_type',
      'physical_activity_level',
      'smoking_status',
      'alcohol_consumption',
      'family_medical_history',
    ],
  },
  andrologo: {
    required: ['birth_date', 'urological_complaint', 'symptom_duration', 'medications'],
    optional: ['chronic_conditions', 'previous_urological_exams'],
  },
}

// ---------------------------------------------------------------------------
// FIELD_PRIMARY_OWNER — which specialist primarily collects shared fields
// Fields NOT in this map are "owned" by whoever requires them (ask directly).
// ---------------------------------------------------------------------------

export const FIELD_PRIMARY_OWNER: Record<string, string> = {
  // Personal / biometric — dietista owns general measurements
  birth_date: 'mmg',
  blood_type: 'mmg',
  weight: 'dietista',
  height: 'dietista',

  // Medical history — mmg owns general medical history
  chronic_conditions: 'mmg',
  medications_current: 'mmg',
  family_medical_history: 'mmg',
  smoking_status: 'mmg',
  alcohol_consumption: 'mmg',

  // Mental health history — psicologo owns psychological history
  mental_health_history_brief: 'psicologo',

  // Lifestyle / physical activity
  physical_activity_level: 'persona-trainer',

  // Nutrition macros — dietista owns macro targets
  macro_carbs_g: 'dietista',
  macro_protein_g: 'dietista',
  macro_fat_g: 'dietista',
  calorie_target: 'dietista',
  food_intolerances: 'dietista',

  // Physical performance — persona-trainer owns performance data
  resting_heart_rate: 'persona-trainer',
  previous_injuries_history: 'persona-trainer',

  // Wellbeing — sleep-coach owns sleep quality; mmg owns stress
  sleep_quality: 'sleep-coach',
  stress_level: 'mmg',

  // Sleep — sleep-coach owns all sleep data
  sleep_hours: 'sleep-coach',
  sleep_latency: 'sleep-coach',
  night_wakings: 'sleep-coach',

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

  // Rheumatology — reumatologo owns autoimmune/joint data
  joint_pain_location: 'reumatologo',
  joint_stiffness_duration: 'reumatologo',
  autoimmune_markers: 'reumatologo',

  // Psychiatry — psichiatra owns psychiatric history and mental meds
  psychiatric_history: 'psichiatra',
  substance_use: 'psichiatra',

  // Nutrition specialist — dietologo owns metabolic conditions
  metabolic_condition: 'dietologo',

  // Supplements — biologo-nutrizionista owns supplement data
  supplements_current: 'biologo-nutrizionista',

  // Neurologo — owns neurological-specific fields
  neurological_complaint: 'neurologo',
  associated_symptoms: 'neurologo',
  previous_neurological_diagnosis: 'neurologo',
  family_history_neurological: 'neurologo',

  // Ortopedico — owns musculoskeletal-specific fields
  musculoskeletal_complaint: 'ortopedico',
  injury_mechanism: 'ortopedico',
  previous_imaging: 'ortopedico',

  // Urologo — owns urological-specific fields
  urological_complaint: 'urologo',
  urinary_frequency: 'urologo',
  previous_urological_exams: 'urologo',
  prostate_history: 'urologo',

  // Oculista — owns visual-specific fields
  visual_complaint: 'oculista',
  symptom_onset: 'oculista',
  current_correction: 'oculista',
  last_eye_exam: 'oculista',
  family_history_ocular: 'oculista',
  systemic_diseases: 'oculista',

  // ORL — owns ENT-specific fields
  ent_complaint: 'otorinolaringoiatra',
  allergies: 'otorinolaringoiatra',
  previous_ent_treatments: 'otorinolaringoiatra',

  // Pneumologo — owns respiratory-specific fields
  respiratory_complaint: 'pneumologo',
  dyspnea_on_exertion: 'pneumologo',
  spirometry_results: 'pneumologo',
  occupational_exposure: 'pneumologo',

  // Ginecologo — owns gynecological-specific fields
  gynecological_complaint: 'ginecologo',
  menstrual_cycle: 'ginecologo',
  last_period: 'ginecologo',
  contraception: 'ginecologo',
  gynecological_history: 'ginecologo',
  obstetric_history: 'ginecologo',
  last_pap_test: 'ginecologo',
  hormonal_therapy: 'ginecologo',

  // Diabetologo — owns diabetes-specific fields
  diabetes_type: 'diabetologo',
  glycemia_fasting: 'diabetologo',
  hba1c: 'diabetologo',
  diabetes_medications: 'diabetologo',
  cgm_use: 'diabetologo',
  hypoglycemia_episodes: 'diabetologo',
  diabetic_complications: 'diabetologo',
  diet_adherence: 'diabetologo',

  // Infettivologo — owns infection-specific fields
  infectious_complaint: 'infettivologo',
  fever_duration: 'infettivologo',
  immunological_status: 'infettivologo',
  recent_travel: 'infettivologo',
  chronic_infections: 'infettivologo',
  recent_antibiotics: 'infettivologo',
  vaccination_status: 'infettivologo',

  // Oncologo — owns oncology-specific fields
  oncological_diagnosis: 'oncologo',
  oncology_current_treatment: 'oncologo',
  oncology_treatment_phase: 'oncologo',
  oncology_performance_status: 'oncologo',
  side_effects_current: 'oncologo',
  last_oncology_visit: 'oncologo',
  nutritional_status_oncology: 'oncologo',
  pain_level_oncology: 'oncologo',

  // Allergologo — owns allergy-specific fields
  allergic_complaint: 'allergologo',
  known_allergens: 'allergologo',
  reaction_type: 'allergologo',
  symptom_triggers: 'allergologo',
  allergy_tests_done: 'allergologo',
  emergency_medications: 'allergologo',
  immunotherapy_history: 'allergologo',

  // Geriatra — owns geriatric-specific fields
  geriatric_complaint: 'geriatra',
  polypharmacy: 'geriatra',
  functional_autonomy: 'geriatra',
  cognitive_screening: 'geriatra',
  fall_history: 'geriatra',
  nutritional_status_elderly: 'geriatra',
  caregiver_support: 'geriatra',
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
  { key: 'birth_date', profileKey: 'birthDate' },
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
        if (k === 'birthDate') map.set('birth_date', display + (v.unit ? ` ${v.unit}` : ''))
        if (k === 'birth_date') map.set('birthDate', display + (v.unit ? ` ${v.unit}` : ''))
      }
    }
  }
  return map
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
