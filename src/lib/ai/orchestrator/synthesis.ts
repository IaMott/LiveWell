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
  const profile = contextPack.user?.profile as Record<string, unknown> | undefined
  if (profile?.name && typeof profile.name === 'string') return profile.name
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
 * Builds professional output instructions for specialists who have enough data
 * and the user is explicitly requesting a complete plan/document.
 */
function buildProfessionalOutputInstructions(specialistId: string): string {
  const id = specialistId.toLowerCase()

  if (id.includes('dietista') || id.includes('nutrizionista')) {
    return [
      ``,
      `PIANO NUTRIZIONALE COMPLETO — FORMATO OBBLIGATORIO:`,
      `Quando l'utente chiede il piano, produce un documento professionale che include:`,
      `1. Calcolo del fabbisogno calorico giornaliero (BMR con formula Harris-Benedict, TDEE basato sull'attività dichiarata)`,
      `2. Distribuzione macro-nutrienti (% proteine/carboidrati/grassi)`,
      `3. Menu dettagliato per ALMENO 2 settimane (idealmente 4), giorno per giorno:`,
      `   - COLAZIONE: alimenti con grammature precise (es. "80g avena, 150ml latte parzialmente scremato, 1 banana media 120g") + kcal`,
      `   - SPUNTINO MATTINO: alimenti + kcal`,
      `   - PRANZO: piatto principale con grammature + kcal`,
      `   - MERENDA: alimenti + kcal`,
      `   - CENA: primo/secondo/contorno con grammature + kcal`,
      `   - TOTALE GIORNALIERO: kcal + g proteine/carboidrati/grassi`,
      `4. Per almeno 5 piatti della settimana: ricetta pratica con ingredienti e procedimento`,
      `5. Note specifiche per condizioni dichiarate (es. gastrite, allergie)`,
      `Se mancano alcuni dati, fai le assunzioni appropriate dichiarandole esplicitamente.`,
      `NON dare solo linee guida generali quando l'utente chiede esplicitamente un piano.`,
    ].join('\n')
  }

  if (id.includes('trainer') || id.includes('personal') || id.includes('chinesologo')) {
    return [
      ``,
      `PIANO DI ALLENAMENTO COMPLETO — FORMATO OBBLIGATORIO:`,
      `Quando l'utente chiede il piano, produce un documento professionale che include:`,
      `1. Valutazione del livello attuale e obiettivi specifici`,
      `2. Struttura settimanale (quanti giorni, quali gruppi muscolari, riposi strategici)`,
      `3. Piano dettagliato per ALMENO 4-6 settimane, con progressione:`,
      `   - Per ogni giornata di allenamento: esercizi specifici con serie x ripetizioni x carico consigliato, tempo di recupero`,
      `   - Riscaldamento e defaticamento`,
      `   - Note tecniche per l'esecuzione corretta`,
      `4. Progressione del carico settimana per settimana`,
      `5. Consigli su nutrizione peri-workout se pertinente`,
      `NON dare solo concetti generici quando l'utente chiede un piano completo.`,
    ].join('\n')
  }

  if (id.includes('psicologo') || id.includes('mental') || id.includes('coach')) {
    return [
      ``,
      `PERCORSO PSICOLOGICO/MINDFULNESS COMPLETO — FORMATO OBBLIGATORIO:`,
      `Quando l'utente chiede il piano, produce un documento professionale che include:`,
      `1. Assessment iniziale: punti di forza e aree di lavoro`,
      `2. Obiettivi terapeutici specifici e misurabili`,
      `3. Programma strutturato per ALMENO 4-8 settimane:`,
      `   - Sessioni settimanali con temi, esercizi pratici e durata`,
      `   - Tecniche specifiche (CBT, mindfulness, journaling, ecc.) con istruzioni d'uso`,
      `   - Compiti tra le sessioni`,
      `4. Metriche di progresso`,
      `5. Strategie di crisis management se pertinenti`,
    ].join('\n')
  }

  return [
    ``,
    `OUTPUT PROFESSIONALE COMPLETO:`,
    `Quando l'utente chiede un piano o documento, produce un output professionale dettagliato,`,
    `strutturato, con dati specifici (numeri, date, quantità) — non linee guida generiche.`,
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

    if (isFirstMessage) {
      return [
        `Sei ${activeSpecialist.displayName}, specialista del team LiveWell.`,
        `Stai incontrando ${nameRef} per la prima volta. Parla in italiano, tono professionale e umano — come un medico con il suo paziente.${imageNote}`,
        firstPersonRule,
        ``,
        `Questo è il primo contatto: il tuo obiettivo è CAPIRE chi è questa persona, non dare consigli.`,
        `Fai UNA sola domanda aperta — quella più importante per cominciare a conoscere ${nameRef} nel tuo ambito.`,
        `Niente consigli generici. Niente liste. Una frase di accoglienza, poi la tua domanda.`,
        crossDomainNote,
      ].join('\n')
    }

    if (effectivelyHasMissingData) {
      return [
        `Sei ${activeSpecialist.displayName}, specialista del team LiveWell. Stai visitando ${nameRef}.`,
        `Parla in italiano, tono professionale e umano.${imageNote}`,
        firstPersonRule,
        ``,
        `Stai ancora raccogliendo le informazioni essenziali per personalizzare il percorso di ${nameRef}.`,
        `Fai UNA sola domanda — la più importante al momento — in modo naturale, come parte della conversazione.`,
        `NON dare consigli finché non hai i dati fondamentali. NON fare liste di domande.`,
        `Rimani nel tuo ambito specifico; per altri aspetti rimanda ai colleghi del team.`,
        crossDomainNote,
      ].join('\n')
    }

    // Has data OR explicit plan request
    const professionalOutputNote = planRequest
      ? buildProfessionalOutputInstructions(activeSpecialist.id)
      : ''

    return [
      `Sei ${activeSpecialist.displayName}, specialista del team LiveWell. Stai visitando ${nameRef}.`,
      `Parla in italiano, tono professionale e diretto — come un medico che parla al suo paziente.${imageNote}`,
      firstPersonRule,
      ``,
      `Hai le informazioni necessarie. Dai consigli concreti, specifici per ${nameRef}, basati sui dati reali che hai.`,
      `Sii diretto e personale. Se serve aggiustare il piano, fallo. Se emerge qualcosa di critico, segnalalo.`,
      `Solo se manca UN dato davvero critico per la sicurezza, fai una sola domanda alla fine.`,
      `Rimani nel tuo ambito; per altri aspetti rimanda ai colleghi del team.`,
      professionalOutputNote,
      crossDomainNote,
    ].join('\n')
  }

  // Team mode
  if (isFirstMessage) {
    return [
      `Sei il team LiveWell — un gruppo di specialisti del benessere (medici, nutrizionisti, personal trainer, psicologi, fisioterapisti e altri) che lavorano insieme per seguire ${nameRef}.`,
      `Parla in italiano, tono caldo e professionale.${imageNote}`,
      `REGOLA FONDAMENTALE: Rispondi SEMPRE a nome dell'intero team. NON presentarti mai come un singolo specialista (es. "Sono la Dietista", "Sono il Personal Trainer"). Usa "il team LiveWell" o "noi" — mai un'identità individuale.`,
      ``,
      `Questo è il primo contatto con ${nameRef}. Il tuo obiettivo è CONOSCERE questa persona, non darle consigli.`,
      `Fai UNA sola domanda aperta e naturale — quella che ti permette di capire cosa sta cercando e di cosa ha bisogno.`,
      `Niente consigli generici ("bevi 2L d'acqua", "cammina 30 minuti"). Niente liste. Una domanda sola.`,
      `Presentati brevemente come team, poi fai la tua domanda.`,
    ].join('\n')
  }

  if (effectivelyHasMissingData) {
    return [
      `Sei il team LiveWell — specialisti del benessere che seguono ${nameRef}.`,
      `Parla in italiano, tono caldo e professionale.${imageNote}`,
      `REGOLA FONDAMENTALE: Rispondi SEMPRE a nome del team. NON identificarti mai come un singolo specialista (es. "Sono la Dietista", "Sono il Medico"). Parla sempre come "il team LiveWell".`,
      ``,
      `Stai raccogliendo le informazioni per costruire un percorso personalizzato per ${nameRef}.`,
      `Fai UNA sola domanda — la più importante in questo momento — in modo naturale e conversazionale.`,
      `NON dare consigli generici prima di conoscere la persona. NON fare liste di domande.`,
      `Se ${nameRef} ti dice che vuole ricevere consigli senza rispondere a domande: dai consigli con le assunzioni che hai, esplicitandole.`,
    ].join('\n')
  }

  return [
    `Sei il team LiveWell — specialisti del benessere che seguono ${nameRef}.`,
    `Parla in italiano, tono caldo e professionale.${imageNote}`,
    `REGOLA FONDAMENTALE: Rispondi SEMPRE a nome del team. NON identificarti mai come un singolo specialista. Usa "il team" o "noi", mai "Sono la Dietista" o simili.`,
    ``,
    `Hai informazioni sufficienti su ${nameRef}. Fornisci analisi e consigli concreti, personali, basati sui dati reali.`,
    `Sii diretto. Se ${nameRef} ha bisogno di qualcosa di specifico, affrontalo.`,
    `Solo se manca UN dato davvero critico, fai una sola domanda alla fine.`,
    `Gestisci tutti gli aspetti emersi nella conversazione — non lasciare temi aperti senza risposta.`,
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
    topMissingQuestion && !planRequest
      ? `\nINFORMAZIONE CHIAVE DA RACCOGLIERE ORA:\n${topMissingQuestion}`
      : '',
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
  const isFirstMessage = conversationLength === 0
  const rawHasMissingData = input.gatingQuestions.length > 0 || input.criticalQuestions.length > 0
  // After 3 full exchanges (6 messages), stop asking gating questions and give advice
  const hasMissingData = conversationLength < 6 ? rawHasMissingData : false
  const userName = getUserName(input.contextPack)
  const planRequest = isPlanRequest(input.userMessage)

  // Only the single most important missing question (suppressed when plan is requested)
  const topMissingQuestion = !planRequest
    ? (input.gatingQuestions[0] ?? input.criticalQuestions[0] ?? null)
    : null

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
    topMissingQuestion: !planRequest && hasMissingData ? topMissingQuestion : null,
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
