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
  'biologo-nutrizionista': {
    required: ['weight', 'height', 'goal', 'allergy', 'meal_pattern'],
    optional: ['supplements_current', 'functional_goal', 'lab_results_nutrition'],
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
  'sleep-coach': {
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
  reumatologo: {
    required: [
      'joint_pain_location',
      'joint_stiffness_duration',
      'symptom_duration',
      'autoimmune_markers',
      'medications',
    ],
    optional: ['family_history_autoimmune', 'previous_treatments'],
  },
  psichiatra: {
    required: [
      'complaint',
      'symptom_duration',
      'distress_intensity',
      'psychiatric_history',
      'medications',
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
  // ── Nuovi specialisti ──────────────────────────────────────────────────────
  neurologo: {
    required: [
      'neurological_complaint',
      'symptom_duration',
      'pain_location',
      'pain_intensity',
      'associated_symptoms',
    ],
    optional: ['previous_neurological_diagnosis', 'medications', 'family_history_neurological'],
  },
  ortopedico: {
    required: [
      'musculoskeletal_complaint',
      'injury_mechanism',
      'pain_location',
      'pain_intensity',
      'functional_impact',
    ],
    optional: ['previous_imaging', 'previous_treatments', 'physical_activity'],
  },
  urologo: {
    required: ['urological_complaint', 'symptom_duration', 'urinary_frequency', 'medications'],
    optional: ['previous_urological_exams', 'prostate_history'],
  },
  oculista: {
    required: ['visual_complaint', 'symptom_onset', 'current_correction', 'last_eye_exam'],
    optional: ['family_history_ocular', 'systemic_diseases'],
  },
  otorinolaringoiatra: {
    required: ['ent_complaint', 'symptom_duration', 'associated_symptoms'],
    optional: ['allergies', 'previous_ent_treatments', 'smoking_status'],
  },
  pneumologo: {
    required: [
      'respiratory_complaint',
      'symptom_duration',
      'dyspnea_on_exertion',
      'smoking_status',
    ],
    optional: ['spirometry_results', 'allergies', 'occupational_exposure'],
  },

  ginecologo: {
    required: ['gynecological_complaint', 'menstrual_cycle', 'last_period', 'contraception'],
    optional: ['gynecological_history', 'obstetric_history', 'last_pap_test', 'hormonal_therapy'],
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
      'oncological_diagnosis',
      'oncology_current_treatment',
      'oncology_treatment_phase',
      'oncology_performance_status',
    ],
    optional: [
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
    required: ['geriatric_complaint', 'age', 'polypharmacy', 'functional_autonomy'],
    optional: [
      'cognitive_screening',
      'fall_history',
      'nutritional_status_elderly',
      'caregiver_support',
    ],
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

  // Biologo nutrizionista
  supplements_current: 'Stai assumendo integratori alimentari? Se sì, quali e a quale dosaggio?',
  functional_goal:
    'Hai un obiettivo funzionale specifico (performance cognitiva, energia, longevità, microbiota, anti-infiammazione)?',
  lab_results_nutrition:
    'Hai eseguito di recente analisi che includono vitamine (D, B12, folati), ferro, zinco o altri micronutrienti?',

  // Dietologo
  metabolic_condition:
    'Hai patologie metaboliche attive (diabete, dislipidemia, ipertensione, insufficienza renale, celiachia)?',
  family_history_metabolic:
    'In famiglia ci sono casi di diabete, obesità grave o malattie cardiovascolari?',

  // Reumatologo
  joint_pain_location: 'Quali articolazioni sono interessate dal dolore o dal gonfiore?',
  joint_stiffness_duration:
    'Al mattino, per quanto tempo le articolazioni sono rigide prima di sciogliersi?',
  autoimmune_markers:
    'Hai eseguito esami specifici come fattore reumatoide (FR), anti-CCP, ANA, VES o PCR?',
  family_history_autoimmune:
    'In famiglia ci sono casi di artrite reumatoide, lupus o altre malattie autoimmuni?',

  // Psichiatra
  psychiatric_history:
    'Hai già ricevuto diagnosi o trattamenti psichiatrici in passato (farmaci, ricoveri, percorsi specialistici)?',
  family_history_mental:
    'In famiglia ci sono casi di disturbi psichiatrici (depressione, bipolare, schizofrenia)?',
  substance_use: 'Consumi alcol, sostanze o farmaci al di fuori delle prescrizioni mediche?',

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

  // Neurologo
  neurological_complaint:
    'Qual è il problema neurologico principale che stai riscontrando (cefalea, vertigini, formicolio, debolezza, altro)?',
  associated_symptoms:
    'Hai sintomi associati come nausea, disturbi visivi, difficoltà a parlare o camminare?',
  previous_neurological_diagnosis:
    'Hai già ricevuto una diagnosi neurologica in passato (emicrania, neuropatia, ernia, ecc.)?',
  family_history_neurological:
    'In famiglia ci sono casi di malattie neurologiche (ictus, epilessia, sclerosi multipla, Parkinson)?',

  // Ortopedico
  musculoskeletal_complaint:
    'Qual è il problema osteoarticolare principale (dolore, frattura, instabilità, limitazione del movimento)?',
  injury_mechanism:
    'Come si è verificato il problema (trauma acuto, usura progressiva, movimento improvviso, senza causa apparente)?',
  previous_imaging:
    'Hai eseguito radiografie, risonanze o TAC recenti? Puoi condividere i referti?',

  // Urologo
  urological_complaint:
    'Qual è il problema urologico principale (dolore, difficoltà a urinare, frequenza, altro)?',
  urinary_frequency:
    'Con quale frequenza urinai? Noti urgenza, gocciolamento, flusso ridotto o bruciore?',
  previous_urological_exams:
    'Hai eseguito esami urologici recenti (ecografia, PSA, urinocoltura, analisi delle urine)?',
  prostate_history: 'Hai una storia di problemi prostatici o hai già eseguito visite urologiche?',

  // Oculista
  visual_complaint:
    'Qual è il problema visivo principale (vista sfocata, dolore, lacrimazione, occhio secco, perdita di visione)?',
  symptom_onset: 'Quando è comparso il problema (improvvisamente o gradualmente)?',
  current_correction:
    'Usi occhiali o lenti a contatto? Quando è stato eseguito il tuo ultimo controllo della vista?',
  last_eye_exam: 'Quando hai effettuato il tuo ultimo controllo oculistico?',
  family_history_ocular:
    'In famiglia ci sono casi di glaucoma, degenerazione maculare o altri problemi oculari?',
  systemic_diseases:
    'Hai malattie sistemiche che possono interessare gli occhi (diabete, ipertensione, malattie autoimmuni)?',

  // Otorinolaringoiatra
  ent_complaint:
    'Qual è il problema principale (orecchio, naso, gola, voce, udito, equilibrio, russare)?',
  allergies: 'Hai allergie note (alimentari, ambientali, a farmaci)?',
  previous_ent_treatments:
    'Hai già eseguito trattamenti ORL in passato (operazioni, terapie, visite specialistiche)?',
  smoking_status: 'Fumi o hai fumato? Da quanto tempo e quante sigarette al giorno?',

  // Pneumologo
  respiratory_complaint:
    'Qual è il problema respiratorio principale (tosse, fiato corto, sibilo, catarro, altro)?',
  dyspnea_on_exertion:
    'Hai difficoltà respiratorie sotto sforzo (salire le scale, camminare veloce)?',
  spirometry_results: 'Hai mai eseguito una spirometria o altri test della funzione respiratoria?',
  occupational_exposure:
    'Sei esposto a polveri, sostanze chimiche o agenti irritanti nel lavoro o in casa?',

  // Ginecologo
  gynecological_complaint:
    'Qual è il problema ginecologico principale (ciclo irregolare, dolore pelvico, perdite, menopausa, altro)?',
  menstrual_cycle:
    'Come descrivi il tuo ciclo mestruale (regolare, irregolare, doloroso, abbondante)?',
  last_period: 'Quando è iniziato il tuo ultimo ciclo mestruale?',
  contraception: 'Usi contraccettivi? Se sì, quali?',
  gynecological_history:
    'Hai avuto in passato problemi ginecologici (endometriosi, PCOS, fibromi, infezioni, interventi)?',
  obstetric_history: 'Hai avuto gravidanze? Quante e con quale esito?',
  last_pap_test: 'Quando hai eseguito il tuo ultimo Pap test o screening HPV?',
  hormonal_therapy:
    'Stai seguendo o hai seguito terapia ormonale sostitutiva o contraccettiva ormonale?',

  // Diabetologo
  diabetes_type:
    'Hai una diagnosi di diabete? Se sì, di quale tipo (tipo 1, tipo 2, gestazionale)?',
  glycemia_fasting: 'Qual è il tuo ultimo valore di glicemia a digiuno?',
  hba1c: 'Conosci il tuo ultimo valore di emoglobina glicata (HbA1c)?',
  diabetes_medications:
    'Stai assumendo farmaci per il diabete (metformina, insulina, GLP-1 agonisti, altro)?',
  cgm_use: 'Usi un dispositivo per il monitoraggio continuo della glicemia (CGM/sensore)?',
  hypoglycemia_episodes: 'Hai episodi di ipoglicemia (bassa glicemia)? Con quale frequenza?',
  diabetic_complications:
    'Hai complicanze legate al diabete (neuropatia, nefropatia, retinopatia, piede diabetico)?',
  diet_adherence: 'Segui una dieta specifica per il controllo glicemico?',

  // Infettivologo
  infectious_complaint:
    'Qual è il problema infettivologico principale (febbre persistente, infezione ricorrente, HIV, epatite, altro)?',
  fever_duration: 'Da quanto tempo hai la febbre o il sintomo infettivo?',
  immunological_status:
    'Hai condizioni che abbassano le difese immunitarie (HIV, chemioterapia, terapie immunosoppressive)?',
  recent_travel: 'Hai viaggiato di recente in zone tropicali o a rischio endemico?',
  chronic_infections:
    'Hai infezioni croniche note (HIV, epatite B o C, tubercolosi latente, altro)?',
  recent_antibiotics: 'Hai assunto antibiotici di recente? Quali e per quanto tempo?',
  vaccination_status: 'Il tuo schema vaccinale è aggiornato? Hai ricevuto vaccini di recente?',

  // Oncologo (supportivo)
  oncological_diagnosis:
    'Qual è la tua diagnosi oncologica (tipo di tumore, sede, stadio se noto)?',
  oncology_current_treatment:
    'Stai seguendo un trattamento attivo (chemioterapia, radioterapia, immunoterapia, ormonoterapia, altro)?',
  oncology_treatment_phase:
    'In che fase del percorso oncologico sei (prima linea, mantenimento, follow-up, guarigione)?',
  oncology_performance_status:
    'Come valuti la tua capacità funzionale quotidiana (ECOG/Karnofsky se noto, oppure descrivi)?',
  side_effects_current:
    'Stai riscontrando effetti collaterali dalla terapia (nausea, fatigue, mucositi, dolore, altro)?',
  last_oncology_visit: "Quando hai avuto il tuo ultimo appuntamento con l'oncologo?",
  nutritional_status_oncology: 'Hai perso peso involontariamente o hai difficoltà ad alimentarti?',
  pain_level_oncology: 'Se presente, come valuteresti il dolore su una scala da 1 a 10?',

  // Allergologo
  allergic_complaint:
    'Qual è il problema allergologico principale (rinite, orticaria, asma, allergia alimentare, altro)?',
  known_allergens:
    'Hai allergeni già identificati (pollini, acari, nichel, latticini, arachidi, farmaci, altro)?',
  reaction_type:
    'Come si manifesta la reazione allergica (prurito, gonfiore, difficoltà respiratoria, shock anafilattico)?',
  symptom_triggers: 'Cosa scatena i sintomi (stagione, alimenti, animali, profumi, farmaci)?',
  allergy_tests_done:
    'Hai già eseguito test allergologici (prick test, patch test, RAST/IgE specifiche)?',
  emergency_medications:
    'Porti con te un autoiniettore di adrenalina (EpiPen) o antistaminici di emergenza?',
  immunotherapy_history:
    'Hai mai fatto o stai facendo immunoterapia allergene-specifica (SLIT o SCIT)?',

  // Geriatra
  geriatric_complaint:
    'Qual è il problema principale (caduta, memoria, deambulazione, gestione farmaci, autonomia quotidiana, altro)?',
  polypharmacy: 'Quanti farmaci assumi regolarmente? Puoi elencarli o allegare la lista?',
  functional_autonomy:
    'Riesci a svolgere le attività quotidiane autonomamente (vestirsi, lavarsi, cucinare, muoversi)?',
  cognitive_screening:
    'Hai eseguito test della memoria o valutazioni cognitive di recente? Quali risultati?',
  fall_history: "Hai avuto cadute nell'ultimo anno? Quante e in quali circostanze?",
  nutritional_status_elderly:
    'Mangi regolarmente e in quantità adeguata? Hai perso peso di recente?',
  caregiver_support: 'Hai un caregiver o supporto familiare? Chi si occupa di te?',
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
  'biologo-nutrizionista': {
    goal: 'Qual è il tuo obiettivo nutrizionale-funzionale principale (performance, longevità, microbiota, anti-infiammazione)?',
    allergy:
      'Hai allergie alimentari certificate o intolleranze documentate da escludere nella pianificazione?',
  },
  dietologo: {
    goal: 'Qual è il tuo obiettivo nutrizionale medico principale (perdita di peso, gestione del diabete, dislipidemia, altra patologia)?',
    medications:
      'Stai assumendo farmaci che possono interagire con la dieta (warfarin, metformina, diuretici, cortisonici)?',
  },
  reumatologo: {
    symptom_duration: 'Da quanto tempo hai questi dolori o gonfiori articolari?',
    medications: 'Stai assumendo farmaci per le articolazioni (FANS, cortisone, MTX, biologici)?',
  },
  psichiatra: {
    complaint:
      'Cosa ti ha portato a cercare supporto psichiatrico? Descrivi il problema principale.',
    symptom_duration:
      'Da quanto tempo sono presenti questi sintomi e come si sono evoluti nel tempo?',
    distress_intensity:
      'Su una scala da 1 a 10, quanto stanno compromettendo la tua vita quotidiana (lavoro, relazioni, cura di sé)?',
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

  // Sleep — sleep-coach owns all sleep data
  sleep_hours: 'sleep-coach',
  sleep_latency: 'sleep-coach',
  night_wakings: 'sleep-coach',
  sleep_quality: 'sleep-coach',

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
  smoking_status: 'otorinolaringoiatra',

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
