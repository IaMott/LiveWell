import { ActiveSpecialist, AgentProposal, ContextPack } from '../types'
import { LlmClient } from './agentExecution'

export type SynthesisInput = {
  llm: LlmClient
  userMessage: string
  proposals: AgentProposal[]
  gatingQuestions: string[]
  criticalQuestions: string[]
  contextPack: ContextPack
  activeSpecialist?: ActiveSpecialist
  /** Base64-encoded images to pass as multimodal content (data:mime;base64,...) */
  imageData?: Array<{ mimeType: string; data: string }>
}

export type SynthesisResult = {
  rawText: string
  fallbackUsed: boolean
}

function buildSummaries(proposals: AgentProposal[]): string {
  return proposals
    .filter((p) => p.summary)
    .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
    .map((p) => p.summary)
    .join('\n')
}

function buildTopRecommendations(proposals: AgentProposal[]): string {
  return proposals
    .flatMap((p) => p.recommendations ?? [])
    .slice(0, 3)
    .map((r) => `• ${r.title}: ${r.steps.slice(0, 2).join('; ')}`)
    .join('\n')
}

function buildRecentHistory(contextPack: ContextPack): string {
  return contextPack.history.recentMessages
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content.slice(0, 200)}`)
    .join('\n')
}

function getUserName(contextPack: ContextPack): string | null {
  // 1. Account name (from User model — always authoritative)
  const profile = contextPack.user?.profile as Record<string, unknown> | undefined
  if (profile?.name && typeof profile.name === 'string') return profile.name.split(' ')[0] ?? null
  // 2. Stored personal.name attribute (user told name during chat)
  const attrs = contextPack.user?.attributes as
    | Record<string, Record<string, { value?: unknown }>>
    | undefined
  const personalName = attrs?.personal?.name?.value
  if (typeof personalName === 'string' && personalName.length > 0)
    return personalName.split(' ')[0] ?? null
  return null
}

/**
 * Returns true when the user is explicitly requesting a concrete plan/output,
 * not just asking a question or giving information.
 */
function isPlanRequest(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  return (
    /\b(dammi|dai|crea|genera|prepara|elabora|scrivi|fai|producimi|voglio|ho bisogno di|puoi darmi|fornisci)\b.{0,30}\b(piano|programma|schema|dieta|menu|protocollo|percorso|calendario|settimane|mese|giornate)\b/i.test(
      lower,
    ) ||
    /\b(piano|programma|dieta|menu|protocollo)\b.{0,20}\b(nutrizionale|alimentare|di allenamento|fitness|psicologico|terapeutico|di recupero|dettagliato|completo)\b/i.test(
      lower,
    ) ||
    /\bcosa aspettiamo\b|\bprocediamo\b|\biniziamo\b|\bok,?\s*(dai|forza|andiamo)\b/i.test(lower)
  )
}

/**
 * Returns the most appropriate cross-domain specialist name if the proposals
 * indicate the current message is clearly outside the active specialist's domain.
 */
function detectCrossDomainSpecialist(
  proposals: AgentProposal[],
  activeSpecialist: ActiveSpecialist,
): string | null {
  // If there's a proposal from a different domain with high confidence, delegate
  const topAlternative = proposals
    .filter(
      (p) =>
        p.domain !== activeSpecialist.domain &&
        (p.confidence ?? 0) >= 0.6 &&
        p.summary &&
        !p.summary.toLowerCase().includes('[unavailable]'),
    )
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]

  return topAlternative?.agentId ?? null
}

/**
 * Per-agent professional output format mandates.
 * Keys are substrings of agent IDs (lowercase). Matched by first hit.
 * Add new entries here to support new agents — no other code changes needed.
 */
const AGENT_OUTPUT_TEMPLATES: Array<{ match: string[]; instructions: string[] }> = [
  {
    match: ['dietista', 'nutrizionista'],
    instructions: [
      `PIANO NUTRIZIONALE COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Calcolo fabbisogno calorico (BMR Harris-Benedict, TDEE basato sull'attività dichiarata)`,
      `2. Distribuzione macro-nutrienti (% proteine/carboidrati/grassi)`,
      `3. Menu dettagliato per ALMENO 2 settimane (idealmente 4), giorno per giorno:`,
      `   COLAZIONE / SPUNTINO / PRANZO / MERENDA / CENA — con grammature precise (es. "80g avena") e kcal per pasto`,
      `   TOTALE GIORNALIERO: kcal + g proteine/carboidrati/grassi`,
      `4. Per ≥5 piatti della settimana: ricetta con ingredienti e procedimento`,
      `5. Note su condizioni dichiarate (allergie, patologie, farmaci)`,
      `Se mancano dati: usa assunzioni ragionevoli dichiarandole esplicitamente.`,
    ],
  },
  {
    match: ['chef'],
    instructions: [
      `MENU/RICETTE COMPLETE — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Menu completo per il periodo richiesto (es. settimanale/mensile/evento)`,
      `2. Per ogni ricetta: ingredienti con grammature precise, procedimento passo-passo, tempi di preparazione e cottura`,
      `3. Varianti per esigenze alimentari dichiarate (allergie, intolleranze, preferenze)`,
      `4. Lista della spesa consolidata`,
      `5. Consigli di conservazione e preparazione anticipata`,
    ],
  },
  {
    match: ['persona-trainer', 'personal', 'chinesologo'],
    instructions: [
      `PIANO DI ALLENAMENTO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Valutazione del livello attuale e obiettivi specifici`,
      `2. Struttura settimanale (giorni, gruppi muscolari, riposi strategici)`,
      `3. Piano per ALMENO 4-6 settimane con progressione:`,
      `   Per ogni giornata: esercizi con serie × ripetizioni × carico consigliato, recupero, note tecniche`,
      `   Riscaldamento e defaticamento per ogni sessione`,
      `4. Schema di progressione del carico settimana per settimana`,
      `5. Consigli nutrizione peri-workout se pertinente`,
    ],
  },
  {
    match: ['medico-dello-sport'],
    instructions: [
      `PIANO SPORT-MEDICINA COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Valutazione idoneità sportiva e rischi rilevati`,
      `2. Periodizzazione del carico sportivo (mesocicli/macrocicli) con intensità e volumi`,
      `3. Protocollo di prevenzione infortuni specifico per la disciplina`,
      `4. Indicazioni su recupero, monitoraggio parametri fisiologici e test prestazionali`,
      `5. Piano di rientro post-infortunio se applicabile`,
      `6. Consigli nutrizionali sport-specifici`,
    ],
  },
  {
    match: ['fisioterapista'],
    instructions: [
      `PIANO RIABILITATIVO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Assessment funzionale: ROM, forza, dolore (scala NRS), limitazioni`,
      `2. Diagnosi funzionale e obiettivi riabilitativi a breve/medio termine`,
      `3. Programma settimanale per ALMENO 4-8 settimane:`,
      `   Per ogni sessione: esercizi specifici con serie × reps × carico, tempo di tenuta, note esecutive`,
      `   Progressione graduale con criteri di avanzamento`,
      `4. Esercizi domiciliari quotidiani (con istruzioni chiare)`,
      `5. Criteri di stop/rivalutazione e segnali d'allarme`,
    ],
  },
  {
    match: ['fisiatra'],
    instructions: [
      `PIANO FISIATRICO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Inquadramento diagnostico e valutazione disabilità/funzionalità`,
      `2. Obiettivi riabilitativi misurabili (FIM, Barthel o equivalenti)`,
      `3. Piano riabilitativo multidisciplinare per ALMENO 4-12 settimane:`,
      `   Fisioterapia, terapia occupazionale, logopedia se indicati — frequenza e obiettivi per ciascuno`,
      `4. Ausili/ortesi consigliati con indicazioni d'uso`,
      `5. Piano di follow-up e criteri di dimissione`,
    ],
  },
  {
    match: ['sleep-coach', 'sleep'],
    instructions: [
      `PROTOCOLLO SONNO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Assessment del sonno: qualità attuale, latenza, risvegli, orari, igiene`,
      `2. Diagnosi funzionale (insonnia, ritardo di fase, ecc.) e fattori mantenenti`,
      `3. Programma strutturato per 4-6 settimane:`,
      `   Settimana per settimana: tecnica principale (CBT-I, stimulus control, restrizione, ecc.) con istruzioni precise`,
      `   Routine serale raccomandata (orari, attività da fare/evitare)`,
      `4. Diario del sonno da compilare (modello fornito)`,
      `5. Criteri di successo e quando escalare a medico/polisomnografia`,
    ],
  },
  {
    match: ['psicologo'],
    instructions: [
      `PERCORSO PSICOLOGICO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Assessment iniziale: punti di forza, aree di lavoro, formulazione del caso`,
      `2. Obiettivi terapeutici specifici e misurabili (SMART)`,
      `3. Programma per ALMENO 4-8 settimane:`,
      `   Per ogni settimana: tema, tecnica specifica (CBT, ACT, DBT skills, ecc.), esercizi pratici, compiti`,
      `4. Strumenti di monitoraggio (PHQ-9, GAD-7, diario pensieri, ecc.)`,
      `5. Piano di gestione crisi e criteri di escalation`,
    ],
  },
  {
    match: ['mental', 'coach-relazionale', 'relationship-coach', 'relationship coach'],
    instructions: [
      `PERCORSO MENTAL COACHING COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Assessment: valori, risorse, obiettivi di vita/performance, blocchi identificati`,
      `2. Obiettivi di coaching specifici e misurabili`,
      `3. Programma per ALMENO 4-8 settimane:`,
      `   Per ogni settimana: focus, esercizio/pratica principale, riflessione guidata, azione concreta`,
      `4. Tecniche di mindfulness/regolazione emotiva con istruzioni d'uso`,
      `5. Metriche di progresso soggettive e oggettive`,
    ],
  },
  {
    match: ['mmg', 'medico di medicina', 'medicina generale'],
    instructions: [
      `PIANO DI GESTIONE CLINICA COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Sintesi diagnostica: problemi attivi, diagnosi differenziali con probabilità`,
      `2. Piano diagnostico: esami richiesti con razionale e urgenza`,
      `3. Piano terapeutico:`,
      `   Farmaci (nome, dosaggio, posologia, durata, monitoraggio) con razionale EBM`,
      `   Misure non farmacologiche (dieta, attività fisica, igiene)`,
      `4. Safety-netting: segnali d'allarme che richiedono PS/rivalutazione urgente`,
      `5. Follow-up programmato con criteri di escalation specialistica`,
    ],
  },
  {
    match: ['cardiologo'],
    instructions: [
      `PIANO CARDIOLOGICO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Valutazione del rischio cardiovascolare (score, fattori di rischio)`,
      `2. Diagnosi funzionale e piano diagnostico (ECG, ecocardiogramma, holter, ecc.)`,
      `3. Piano terapeutico farmacologico e non farmacologico con target (PA, LDL, FC)`,
      `4. Stile di vita: attività fisica raccomandata (intensità, durata, frequenza), dieta cardiovascolare`,
      `5. Piano di monitoraggio e criteri di ricovero/urgenza`,
    ],
  },
  {
    match: ['endocrinologo'],
    instructions: [
      `PIANO ENDOCRINOLOGICO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Inquadramento: diagnosi, esami ormonali/metabolici rilevanti e target`,
      `2. Piano farmacologico se indicato (nome, dosaggio, timing, monitoraggio)`,
      `3. Piano nutrizionale specifico per la patologia endocrina (es. dieta per tiroidea, IR, ecc.)`,
      `4. Attività fisica raccomandata in relazione alla condizione`,
      `5. Calendario di follow-up con esami programmati e criteri di revisione terapia`,
    ],
  },
  {
    match: ['gastroenterologo'],
    instructions: [
      `PIANO GASTROENTEROLOGICO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Diagnosi funzionale e piano diagnostico (gastroscopia, colonscopia, breath test, ecc.)`,
      `2. Piano terapeutico farmacologico (PPI, probiotici, antispastici, ecc.) con posologia e durata`,
      `3. Piano dietetico specifico per la patologia (dieta FODMAP, senza glutine, ecc.) con esempi pratici`,
      `4. Modifiche stile di vita (pasti, alcol, fumo, stress)`,
      `5. Segnali d'allarme e criteri di rivalutazione urgente`,
    ],
  },
  {
    match: ['dermatologo'],
    instructions: [
      `PIANO DERMATOLOGICO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento professionale che include:`,
      `1. Diagnosi differenziale con probabilità e piano diagnostico (biopsia, patch test, ecc.)`,
      `2. Piano terapeutico topico e/o sistemico (nome farmaco, concentrazione, applicazione, durata)`,
      `3. Routine skincare raccomandata (mattina e sera, prodotti e frequenza)`,
      `4. Trigger da evitare e modifiche comportamentali`,
      `5. Follow-up con criteri di escalation (dermatologo, fotoprotocollo, biologici)`,
    ],
  },
  {
    match: ['analista-contesto', 'analista contesto'],
    instructions: [
      `ANALISI DEL CONTESTO COMPLETA — FORMATO OBBLIGATORIO:`,
      `Produce un documento strutturato che include:`,
      `1. Mappa della situazione attuale: risorse, vincoli, opportunità, minacce (SWOT)`,
      `2. Analisi delle priorità con matrice impatto/urgenza`,
      `3. Scenari alternativi (almeno 3) con pro/contro e probabilità stimata`,
      `4. Piano d'azione raccomandato con milestone, responsabilità e KPI`,
      `5. Risk register: rischi principali, probabilità, impatto, mitigazioni`,
    ],
  },
  {
    match: ['financial-planner', 'financial planner', 'commercialista'],
    instructions: [
      `PIANO FINANZIARIO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento strutturato che include:`,
      `1. Snapshot finanziario attuale: entrate, uscite, patrimonio, debiti`,
      `2. Obiettivi finanziari a breve/medio/lungo termine con cifre target`,
      `3. Piano di budget mensile dettagliato (categoria per categoria)`,
      `4. Strategia di risparmio/investimento con allocazione % e strumenti consigliati`,
      `5. Piano fiscale: ottimizzazione deduzioni/detrazioni applicabili al caso specifico`,
    ],
  },
  {
    match: ['career-coach', 'career coach', 'executive-coach', 'executive coach', 'life-organizer'],
    instructions: [
      `PIANO DI SVILUPPO PERSONALE/PROFESSIONALE COMPLETO — FORMATO OBBLIGATORIO:`,
      `Produce un documento strutturato che include:`,
      `1. Assessment: competenze attuali, gap, valori, motivazioni`,
      `2. Obiettivi SMART a 3, 6 e 12 mesi`,
      `3. Piano d'azione settimanale/mensile:`,
      `   Azioni concrete, risorse necessarie, milestone, metriche di successo`,
      `4. Sviluppo competenze: corsi, libri, esperienze, networking (specifici e prioritizzati)`,
      `5. Gestione ostacoli e piano B per i rischi principali`,
    ],
  },
  {
    match: ['consulente-legale', 'consulente legale'],
    instructions: [
      `ANALISI LEGALE COMPLETA — FORMATO OBBLIGATORIO:`,
      `Produce un documento strutturato che include:`,
      `1. Inquadramento della fattispecie: norme applicabili, giurisprudenza rilevante`,
      `2. Analisi dei rischi legali e valutazione delle opzioni disponibili`,
      `3. Percorso raccomandato: azioni, documenti necessari, tempistiche`,
      `4. Costi stimati (consulenze, spese legali, tasse)`,
      `5. Disclaimer: questo è un orientamento informativo — per atti formali rivolgersi a un avvocato/notaio`,
    ],
  },
]

const DEFAULT_OUTPUT_INSTRUCTIONS = [
  `OUTPUT PROFESSIONALE COMPLETO:`,
  `Quando l'utente chiede un piano o documento, produce un output professionale dettagliato,`,
  `strutturato, con dati specifici (numeri, date, quantità) — non linee guida generiche.`,
  `Se mancano dati, usa assunzioni ragionevoli dichiarandole esplicitamente.`,
]

/**
 * Returns domain-specific format mandates for a given specialist.
 * Scalable: add entries to AGENT_OUTPUT_TEMPLATES to support new agents.
 */
function buildProfessionalOutputInstructions(specialistId: string): string {
  const id = specialistId.toLowerCase()
  const template = AGENT_OUTPUT_TEMPLATES.find((t) => t.match.some((m) => id.includes(m)))
  const lines = template ? template.instructions : DEFAULT_OUTPUT_INSTRUCTIONS
  return [
    ``,
    `REGOLE OUTPUT — OBBLIGATORIE QUANDO L'UTENTE CHIEDE UN PIANO/DOCUMENTO:`,
    ...lines,
    `NON dare solo linee guida generali. Se mancano dati, assumi valori ragionevoli dichiarandoli.`,
  ].join('\n')
}

/**
 * Builds the system prompt for the final synthesis call to Gemini.
 *
 * Core principle: the team LiveWell is like a multidisciplinary clinic.
 * Specialists guide the user, analyse proactively, and communicate with
 * each other. The user never tells the specialists what to do.
 *
 * Phases:
 *   1. No history → first contact: ask ONE open question to understand who the person is.
 *   2. Collecting data (gatingQuestions present) → ask ONE most important question.
 *   3. Enough data → give specific, personalised advice. No more questions unless critical.
 */
function buildSystemPrompt(
  activeSpecialist: ActiveSpecialist | undefined,
  isFirstMessage: boolean,
  hasMissingData: boolean,
  userName: string | null,
  hasImages: boolean,
  userMessage: string,
  proposals: AgentProposal[],
): string {
  const nameRef = userName ? `${userName}` : "l'utente"

  const imageNote = hasImages
    ? `\nHai ricevuto un'immagine allegata da ${nameRef}. Analizzala e integra le informazioni visive nella tua risposta.`
    : ''

  const planRequest = isPlanRequest(userMessage)
  // When user explicitly asks for a plan, override hasMissingData so we don't block output
  const effectivelyHasMissingData = hasMissingData && !planRequest

  if (activeSpecialist) {
    // Check if the current message is better handled by a different specialist
    const crossDomainSpecialistId = detectCrossDomainSpecialist(proposals, activeSpecialist)
    const crossDomainNote = crossDomainSpecialistId
      ? `\n\nIMPORTANTE — ARGOMENTO TRASVERSALE: Questo messaggio riguarda principalmente un ambito di competenza di un altro specialista del team (${crossDomainSpecialistId}). Rispondi come se fossi quel collega specialista per questo specifico punto, indicando esplicitamente il passaggio (es. "Per questo aspetto ti rispondo come [Specialista]..."), poi concludi ricordando che per il percorso principale continuerà ${activeSpecialist.displayName}.`
      : ''

    const firstPersonRule = `Parla SEMPRE in prima persona singolare (io, mi, ti consiglio, penso). NON usare MAI "noi", "il team", "siamo", "il nostro team" o qualsiasi altra forma plurale — sei un singolo specialista.`

    // Anti-pattern: ban robotic openers and self-referential phrases that sound pre-set
    const antiPattern = `NON iniziare MAI la risposta con frasi formule come "Il team LiveWell", "Caro utente", "Gentile utente", "Ti ringrazio per avermi", "Capisco perfettamente", "Certamente", seguito da una riformulazione di ciò che hai appena detto. Varia sempre l'apertura — parla direttamente, come farebbe una persona reale in conversazione.`

    if (isFirstMessage) {
      return [
        `Sei ${activeSpecialist.displayName}. Stai incontrando ${nameRef} per la prima volta.`,
        `Parla in italiano, tono diretto e umano — come un professionista vero, non come un chatbot.${imageNote}`,
        firstPersonRule,
        antiPattern,
        ``,
        `Primo contatto: il tuo obiettivo è CAPIRE chi è questa persona, non dare consigli.`,
        `Fai UNA sola domanda aperta — quella più importante per cominciare a conoscere ${nameRef}.`,
        `Niente consigli generici. Niente liste. Va bene anche andare dritti alla domanda senza preamboli.`,
        crossDomainNote,
      ].join('\n')
    }

    if (effectivelyHasMissingData) {
      return [
        `Sei ${activeSpecialist.displayName}. Stai seguendo ${nameRef}.`,
        `Parla in italiano, tono diretto e professionale.${imageNote}`,
        firstPersonRule,
        antiPattern,
        ``,
        `Stai ancora raccogliendo le informazioni essenziali per personalizzare il percorso di ${nameRef}.`,
        `Fai UNA sola domanda — la più importante al momento — in modo naturale, come parte della conversazione.`,
        `NON dare consigli finché non hai i dati fondamentali. NON fare liste di domande.`,
        `Rimani nel tuo ambito specifico; per altri aspetti rimanda ai colleghi.`,
        crossDomainNote,
      ].join('\n')
    }

    // Has data OR explicit plan request
    const professionalOutputNote = planRequest
      ? buildProfessionalOutputInstructions(activeSpecialist.id)
      : ''

    return [
      `Sei ${activeSpecialist.displayName}. Stai seguendo ${nameRef}.`,
      `Parla in italiano, tono diretto — come un professionista che parla al suo paziente/cliente.${imageNote}`,
      firstPersonRule,
      antiPattern,
      ``,
      `Hai le informazioni necessarie. Dai consigli concreti, specifici per ${nameRef}, basati sui dati reali.`,
      `Sii diretto e personale. Se serve aggiustare il piano, fallo. Se emerge qualcosa di critico, segnalalo.`,
      `Solo se manca UN dato davvero critico, fai una sola domanda alla fine.`,
      `Rimani nel tuo ambito; per altri aspetti rimanda ai colleghi.`,
      professionalOutputNote,
      crossDomainNote,
    ].join('\n')
  }

  // Team mode — anti-pattern block applies to all variants
  const teamAntiPattern = `NON iniziare MAI con: "Il team LiveWell", "Siamo il team LiveWell", "Caro utente", "Gentile utente", "Il team LiveWell ti ringrazia", "Il team LiveWell comprende". Varia sempre l'apertura — rispondi come persone reali, non come un'istituzione formale.`
  const activeSpecialistNote = buildActiveSpecialistNote(proposals)

  if (isFirstMessage) {
    return [
      `Sei un gruppo di specialisti del benessere (medici, nutrizionisti, personal trainer, psicologi, fisioterapisti) che segue ${nameRef}.`,
      `Parla in italiano, tono caldo e diretto — come persone reali, non come un chatbot aziendale.${imageNote}`,
      `Rispondi a nome del gruppo usando "noi". NON presentarti come singolo specialista.`,
      teamAntiPattern,
      activeSpecialistNote,
      ``,
      `Primo contatto: il tuo obiettivo è CONOSCERE ${nameRef}, non darle consigli.`,
      `Fai UNA sola domanda aperta — quella che ti permette di capire cosa sta cercando.`,
      `Niente consigli generici. Niente liste. Puoi iniziare direttamente con la domanda.`,
    ].join('\n')
  }

  if (effectivelyHasMissingData) {
    return [
      `Sei un gruppo di specialisti del benessere che segue ${nameRef}.`,
      `Parla in italiano, tono caldo e diretto.${imageNote}`,
      `Rispondi a nome del gruppo usando "noi". Se l'utente chiede esplicitamente chi sta analizzando il suo caso, cita i nomi degli specialisti attivi.`,
      teamAntiPattern,
      activeSpecialistNote,
      ``,
      `Stai raccogliendo le informazioni per costruire un percorso personalizzato per ${nameRef}.`,
      `Fai UNA sola domanda — la più importante ora — in modo naturale e conversazionale.`,
      `NON dare consigli generici prima di conoscere la persona. NON fare liste di domande.`,
      `Se ${nameRef} vuole consigli senza rispondere: dai consigli con le assunzioni che hai, esplicitandole.`,
    ].join('\n')
  }

  return [
    `Sei un gruppo di specialisti del benessere che segue ${nameRef}.`,
    `Parla in italiano, tono diretto e professionale.${imageNote}`,
    `Rispondi a nome del gruppo usando "noi". Se l'utente chiede esplicitamente chi sta analizzando il suo caso, cita i nomi degli specialisti attivi.`,
    teamAntiPattern,
    activeSpecialistNote,
    ``,
    `Hai informazioni sufficienti su ${nameRef}. Fornisci analisi e consigli concreti, personali, basati sui dati reali.`,
    `Sii diretto. Se ${nameRef} ha bisogno di qualcosa di specifico, affrontalo.`,
    `Solo se manca UN dato davvero critico, fai una sola domanda alla fine.`,
    `Gestisci tutti gli aspetti emersi — non lasciare temi aperti senza risposta.`,
  ].join('\n')
}

function buildUserPrompt(params: {
  userMessage: string
  summaries: string
  topRecommendations: string
  recentHistory: string
  /** The single most important missing datum — if any */
  topMissingQuestion: string | null
  hasImages: boolean
  planRequest: boolean
}): string {
  const {
    userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    topMissingQuestion,
    hasImages,
    planRequest,
  } = params

  return [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO DI ${hasImages ? 'UTENTE (con allegato immagine)' : 'UTENTE'}: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries || '(primo contatto — nessun dato sul profilo ancora)',
    topRecommendations ? `\nRACCOMANDAZIONI EMERSE:\n${topRecommendations}` : '',
    topMissingQuestion ? `\nINFORMAZIONE CHIAVE DA RACCOGLIERE ORA:\n${topMissingQuestion}` : '',
    ``,
    `Scrivi la risposta in italiano, rivolta direttamente all'utente.`,
    planRequest
      ? `L'utente chiede esplicitamente un piano/output definitivo. Produci un documento professionale COMPLETO con dati specifici (grammature, kcal, esercizi, serie, ripetizioni, ecc.). NON chiedere altre informazioni — usa i dati disponibili e specifica le assunzioni fatte.`
      : topMissingQuestion
        ? `Fai UNA sola domanda — quella indicata sopra — in modo naturale. Non dare consigli in questo messaggio.`
        : `Dai una risposta diretta, concreta e personalizzata basandoti sui dati disponibili.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Builds a human-readable list of active specialists from proposals.
 * Used to let the synthesis model answer "which specialist analyzed my case".
 */
function buildActiveSpecialistNote(proposals: AgentProposal[]): string {
  const active = proposals
    .filter((p) => (p.confidence ?? 0) > 0 && !p.summary.toLowerCase().includes('[unavailable]'))
    .map((p) => p.agentId)
  if (active.length === 0) return ''
  const formatted = active
    .map((id) =>
      id
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
    )
    .join(', ')
  return `\nSPECIALISTI ATTIVI IN QUESTA CONVERSAZIONE: ${formatted}. Se l'utente chiede esplicitamente chi ha analizzato il suo caso o chi sta rispondendo, cita questi specialisti per nome.`
}

function buildFallbackText(proposals: AgentProposal[]): string {
  return proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
}

/** Extract inline image data from contextPack files (stored as data:mime;base64,...) */
export function extractImageData(
  contextPack: ContextPack,
): Array<{ mimeType: string; data: string }> {
  return (contextPack.files ?? [])
    .filter((f) => f.mimeType?.startsWith('image/') && f.extractedText?.startsWith('data:'))
    .map((f) => {
      const raw = f.extractedText!
      // Format: "data:image/jpeg;base64,<base64data>"
      const comma = raw.indexOf(',')
      const header = raw.slice(0, comma) // "data:image/jpeg;base64"
      const mimeType = header.split(':')[1]?.split(';')[0] ?? f.mimeType
      const data = raw.slice(comma + 1)
      return { mimeType, data }
    })
}

export async function synthesizeRawResponse(input: SynthesisInput): Promise<SynthesisResult> {
  const summaries = buildSummaries(input.proposals)
  const topRecommendations = buildTopRecommendations(input.proposals)
  const recentHistory = buildRecentHistory(input.contextPack)

  const conversationLength = input.contextPack.history.recentMessages.length
  // True only when the user has genuinely never spoken to the system:
  // no messages in the current conversation AND no messages in prior conversations.
  const isFirstMessage =
    conversationLength === 0 &&
    (input.contextPack.history.crossConversationMessages?.length ?? 0) === 0
  const rawHasMissingData = input.gatingQuestions.length > 0 || input.criticalQuestions.length > 0
  // After 3 full exchanges (6 messages), stop asking gating questions and give advice
  const hasMissingData = conversationLength < 6 ? rawHasMissingData : false
  const userName = getUserName(input.contextPack)
  const planRequest = isPlanRequest(input.userMessage)

  // The single most important missing question — always computed, always shown in prompt as context.
  // For plan requests the LLM instruction says "NON chiedere"; the question appears as context only.
  const topMissingQuestion = input.gatingQuestions[0] ?? input.criticalQuestions[0] ?? null

  const imageData =
    input.imageData ?? (input.contextPack.files ? extractImageData(input.contextPack) : [])
  const hasImages = imageData.length > 0

  const system = buildSystemPrompt(
    input.activeSpecialist,
    isFirstMessage,
    hasMissingData,
    userName,
    hasImages,
    input.userMessage,
    input.proposals,
  )
  const user = buildUserPrompt({
    userMessage: input.userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    topMissingQuestion: hasMissingData ? topMissingQuestion : null,
    hasImages,
    planRequest,
  })

  try {
    const res = await input.llm.complete({ system, user, format: 'text', imageData })
    const rawText = res.text.trim()
    if (rawText.startsWith('{') || rawText.startsWith('[')) {
      return { rawText: buildFallbackText(input.proposals), fallbackUsed: true }
    }
    return { rawText, fallbackUsed: false }
  } catch {
    return { rawText: buildFallbackText(input.proposals), fallbackUsed: true }
  }
}
