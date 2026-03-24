import { ActiveSpecialist, AgentProposal, ContextPack } from '../types'
import { buildProfessionalOutputInstructions } from '../artifacts/contracts'
import { LlmClient } from './agentExecution'
import {
  buildAntiRepetitionBlock,
  buildCrossConversationContext,
  buildRecentHistory,
  buildStructuredProfileBlock,
  buildSummaries,
  buildTopRecommendations,
  getUserName,
} from './synthesisContext'

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

/**
 * Returns true when the user is explicitly requesting a concrete plan/output,
 * not just asking a question or giving information.
 * S5: removed bare conversational continuers ("procediamo", "iniziamo", "ok dai") which
 * caused false positives — these do not imply a request for a full professional document.
 */
function isPlanRequest(userMessage: string): boolean {
  const lower = userMessage.toLowerCase()
  return (
    /\b(dammi|dai|crea|genera|prepara|elabora|scrivi|fai|producimi|voglio|ho bisogno di|puoi darmi|fornisci|fammi)\b.{0,40}\b(piano|programma|schema|scheda|dieta|menu|protocollo|percorso|calendario|settimane|mese|giornate|strategia|valutazione|report)\b/i.test(
      lower,
    ) ||
    /\b(piano|programma|dieta|menu|protocollo|scheda|strategia|valutazione|report|percorso)\b.{0,30}\b(nutrizionale|alimentare|di allenamento|fitness|psicologico|terapeutico|di recupero|dettagliato|completo|completa|strutturato|strutturata|professionale)\b/i.test(
      lower,
    ) ||
    /\b(scheda completa|programma dettagliato|protocollo completo|strategia completa|valutazione dettagliata|report dettagliato|menu completo|percorso dettagliato)\b/i.test(
      lower,
    )
  )
}

/**
 * BUG-B fix: Domain-aware plan request detection.
 * Prevents a specialist from producing a professional output template for a request
 * that belongs to a DIFFERENT domain.
 * Example: "voglio iniziare una dieta" with Personal Trainer active → NOT a training plan request.
 */
function isPlanRequestInSpecialistDomain(userMessage: string, specialistId: string): boolean {
  if (!isPlanRequest(userMessage)) return false
  const lower = userMessage.toLowerCase()
  const genericStructuredRequest = /\b(programma|protocollo|report|strategia|valutazione)\b/i.test(
    lower,
  )

  // Training specialists only respond to training-specific plan requests
  const trainingSpecialists = new Set([
    'persona-trainer',
    'chinesologo',
    'medico-dello-sport',
    'fisioterapista',
    'fisiatra',
  ])
  if (trainingSpecialists.has(specialistId)) {
    const ownSignal =
      /\b(allenamento|training|palestra|esercizi|workout|scheda|muscol|forza|cardio|corsa|sport|attività fisica|movimento fisico|sessione|recupero)\b/i.test(
        lower,
      )
    const conflictingSignal =
      /\b(dieta|alimentar|nutriz|menu|mangiare|psicolog|mindfulness|legale|debiti|soldi)\b/i.test(
        lower,
      )
    return ownSignal || (genericStructuredRequest && !conflictingSignal)
  }

  // Nutrition specialists only respond to nutrition-specific plan requests
  const nutritionSpecialists = new Set(['dietista', 'chef', 'gastroenterologo'])
  if (nutritionSpecialists.has(specialistId)) {
    const ownSignal =
      /\b(dieta|alimentar|nutriz|calorie|pasto|mangiare|cibo|ricett|menu|peso|dimagrire|deficit|macros)\b/i.test(
        lower,
      )
    const conflictingSignal =
      /\b(allenamento|workout|esercizi|psicolog|mindfulness|legale|debiti|soldi)\b/i.test(lower)
    return ownSignal || (genericStructuredRequest && !conflictingSignal)
  }

  const mindfulnessSpecialists = new Set(['psicologo', 'mental-coach', 'sleep-coach'])
  if (mindfulnessSpecialists.has(specialistId)) {
    const ownSignal =
      /\b(stress|ansia|burnout|sonno|insonnia|mindfulness|concentrazione|blocco mentale)\b/i.test(
        lower,
      )
    const conflictingSignal = /\b(dieta|alimentar|allenamento|workout|legale|debiti|soldi)\b/i.test(
      lower,
    )
    return ownSignal || (genericStructuredRequest && !conflictingSignal)
  }

  // All other specialists: any recognised plan request is valid
  return true
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
  proposals: AgentProposal[],
  /** BUG-A: number of gating questions — drives singular/plural instruction */
  gatingQuestionCount: number,
  /** BUG-B: whether the plan request is in the active specialist's domain */
  planRequest: boolean,
  hasKnownCaseContext: boolean,
): string {
  const nameRef = userName ? `${userName}` : "l'utente"

  const imageNote = hasImages
    ? `\nHai ricevuto un'immagine allegata da ${nameRef}. Analizzala e integra le informazioni visive nella tua risposta.`
    : ''

  const effectivelyHasMissingData = hasMissingData

  if (activeSpecialist) {
    const firstPersonRule = `Parla SEMPRE in prima persona singolare (io, mi, ti consiglio, penso). NON usare MAI "noi", "il team", "siamo", "il nostro team" o qualsiasi altra forma plurale — sei un singolo specialista.`

    // Anti-pattern: ban robotic openers and self-referential phrases that sound pre-set
    const antiPattern = `NON iniziare MAI la risposta con frasi formule come "Il team LiveWell", "Caro utente", "Gentile utente", "Ti ringrazio per avermi", "Capisco perfettamente", "Certamente", seguito da una riformulazione di ciò che hai appena detto. Varia sempre l'apertura — parla direttamente, come farebbe una persona reale in conversazione.`

    // BUG-C: Anti-gatekeeper rule — agents must never block access to other specialists
    const antiGatekeeperRule = `REGOLA CRITICA: Non sei mai un prerequisito o precondizione per altri specialisti del team. Se ${nameRef} vuole parlare con un collega, sostieni e incoraggia immediatamente quella scelta — non bloccare, non dichiarare sequenze obbligatorie, non ritardare l'accesso. ${nameRef} può rivolgersi a qualsiasi specialista in qualsiasi momento.`

    // BUG-E: Prevent repeating already-communicated data
    const noRepetitionRule = `NON riformulare o ripetere informazioni già menzionate nella conversazione recente (IMC/BMI, peso, altezza, sedentarietà, condizioni note, situazione lavorativa, ecc.). ${nameRef} le conosce già — vai avanti con contenuto nuovo.`

    // Anti-filler: no generic principle blocks unless part of a concrete plan
    const specialistNoFillerRule = `NON includere sezioni di "principi generali" (es. "bevi acqua", "mangia cibi integrali", "fai pause al PC") a meno che stai costruendo un piano completo con indicazioni specifiche per ${nameRef}. Tali sezioni allungano la risposta senza valore aggiunto contestuale.`

    // Anti-repeated-question: don't ask what was already answered
    const specialistNoRepeatedQuestionRule = `Prima di fare una domanda, controlla la conversazione recente. Se la risposta è già stata fornita (frequenza di allenamento, ore di lavoro, sintomi già descritti, obiettivi già espressi), NON ripetere la domanda — usa i dati già noti.`

    // BUG-H: Strict domain boundary + cross-domain guardrail
    const domainBoundaryRule = `Rimani strettamente nel tuo ambito di competenza. Se ${nameRef} menziona qualcosa fuori dal tuo dominio specifico, riconoscilo in UNA sola riga rimandando al collega competente — non approfondire né dare consigli su aree di altri specialisti. Non riportare mai consigli o indicazioni che appartengono al dominio di un altro specialista del team: lascia che sia quello specialista a fornirli direttamente.`

    if (isFirstMessage) {
      return [
        `Sei ${activeSpecialist.displayName}. Stai incontrando ${nameRef} per la prima volta.`,
        `Parla in italiano, tono diretto e umano — come un professionista vero, non come un chatbot.${imageNote}`,
        firstPersonRule,
        antiPattern,
        antiGatekeeperRule,
        ``,
        `Primo contatto: il tuo obiettivo è CAPIRE chi è questa persona, non dare consigli.`,
        `Fai UNA sola domanda aperta — quella più importante per cominciare a conoscere ${nameRef}.`,
        `Niente consigli generici. Niente liste. Va bene anche andare dritti alla domanda senza preamboli.`,
      ].join('\n')
    }

    if (effectivelyHasMissingData) {
      // BUG-A + BUG-G: Batch instruction when multiple baseline questions; acknowledge data provided
      const questionInstruction =
        gatingQuestionCount > 1
          ? `Fai le domande indicate nel prompt (${gatingQuestionCount} dati fondamentali mancanti) in modo naturale — puoi porle insieme come breve scheda di presentazione, in modo colloquiale.`
          : `Fai la domanda indicata nel prompt — in modo naturale, come parte della conversazione.`
      const missingDataRule = planRequest
        ? `NON produrre un piano definitivo finché mancano questi dati. Al massimo puoi anticipare solo una struttura parziale, dichiarando chiaramente che non è ancora finalizzabile.`
        : `NON dare altri consigli finché non hai i dati fondamentali.`

      return [
        `Sei ${activeSpecialist.displayName}. Stai seguendo ${nameRef}.`,
        `Parla in italiano, tono diretto e professionale.${imageNote}`,
        firstPersonRule,
        antiPattern,
        antiGatekeeperRule,
        noRepetitionRule,
        specialistNoFillerRule,
        specialistNoRepeatedQuestionRule,
        ``,
        hasKnownCaseContext
          ? `Il problema attivo è già chiaro: NON tornare a intake generale, non ripartire da goal astratti e non chiedere dati baseline fuori fuoco.`
          : `Stai ancora raccogliendo le informazioni essenziali per personalizzare il percorso di ${nameRef}.`,
        questionInstruction,
        `Se il messaggio di ${nameRef} contiene già dati utili, riconoscili brevemente PRIMA di fare la prossima domanda.`,
        missingDataRule,
        domainBoundaryRule,
      ].join('\n')
    }

    // Has data OR explicit plan request
    const professionalOutputNote = planRequest
      ? buildProfessionalOutputInstructions({
          id: activeSpecialist.id,
          displayName: activeSpecialist.displayName,
          domainTags: activeSpecialist.domains ?? [activeSpecialist.domain],
          systemPrompt: '',
          toolsAllowed: [],
          decisionStyle: 'team-led',
          runtimeCapabilities: activeSpecialist.runtimeCapabilities,
        })
      : ''

    return [
      `Sei ${activeSpecialist.displayName}. Stai seguendo ${nameRef}.`,
      `Parla in italiano, tono diretto — come un professionista che parla al suo paziente/cliente.${imageNote}`,
      firstPersonRule,
      antiPattern,
      antiGatekeeperRule,
      noRepetitionRule,
      specialistNoFillerRule,
      specialistNoRepeatedQuestionRule,
      ``,
      `Hai le informazioni necessarie. Dai consigli concreti, specifici per ${nameRef}, basati sui dati reali.`,
      `Sii diretto e personale. Se serve aggiustare il piano, fallo. Se emerge qualcosa di critico, segnalalo.`,
      `Solo se manca UN dato davvero critico, fai una sola domanda alla fine.`,
      domainBoundaryRule,
      professionalOutputNote,
    ].join('\n')
  }

  // Team mode — anti-pattern block applies to all variants
  const teamAntiPattern = `NON iniziare MAI con: "Il team LiveWell", "Siamo il team LiveWell", "Caro utente", "Gentile utente", "Il team LiveWell ti ringrazia", "Il team LiveWell comprende". Varia sempre l'apertura — rispondi come persone reali, non come un'istituzione formale.`

  if (isFirstMessage) {
    return [
      `Sei un gruppo di specialisti del benessere (medici, nutrizionisti, personal trainer, psicologi, fisioterapisti) che segue ${nameRef}.`,
      `Parla in italiano, tono caldo e diretto — come persone reali, non come un chatbot aziendale.${imageNote}`,
      `Rispondi a nome del gruppo usando "noi". NON presentarti come singolo specialista.`,
      teamAntiPattern,
      ``,
      `Primo contatto: il tuo obiettivo è CONOSCERE ${nameRef}, non dare consigli.`,
      `Fai UNA sola domanda aperta — quella che ti permette di capire cosa sta cercando.`,
      `Niente consigli generici. Niente liste. Puoi iniziare direttamente con la domanda.`,
    ].join('\n')
  }

  // BUG-E: No-repetition rule for team mode too
  const teamNoRepetitionRule = `NON riformulare o ripetere informazioni già menzionate nella conversazione recente (dati biometrici, condizioni note, situazione lavorativa, ecc.). Sono già noti — vai avanti con contenuto nuovo.`

  // Anti-filler: no generic principle blocks unless part of a concrete plan
  const noFillerRule = `NON includere mai sezioni di "principi generali" (es. "bevi 2L d'acqua", "mangia cibi integrali", "fai pause ogni ora") a meno che stai costruendo un piano completo personalizzato con numeri specifici per ${nameRef}. Queste sezioni allungano la risposta senza valore aggiunto.`

  // Anti-repeated-question: before asking, verify the answer isn't already in the recent history
  const noRepeatedQuestionRule = `Prima di fare una domanda, controlla la conversazione recente. Se la risposta è già stata fornita (es. frequenza di allenamento, ore di lavoro, sintomi già descritti), NON ripetere la domanda — usa le informazioni già note.`

  if (effectivelyHasMissingData) {
    // BUG-A: Team mode can now ask up to 3 baseline questions when L1 is pending
    const teamQuestionInstruction =
      gatingQuestionCount > 1
        ? `Fai le domande indicate nel prompt (${gatingQuestionCount} dati fondamentali mancanti) in modo naturale — puoi porle insieme come breve scheda di benvenuto.`
        : `Fai la domanda più importante ora — in modo naturale e conversazionale.`

    return [
      `Sei un gruppo di specialisti del benessere che segue ${nameRef}.`,
      `Parla in italiano, tono caldo e diretto.${imageNote}`,
      `Rispondi a nome del gruppo usando "noi". Se l'utente chiede esplicitamente chi sta analizzando il suo caso, cita i nomi degli specialisti attivi.`,
      teamAntiPattern,
      teamNoRepetitionRule,
      noFillerRule,
      noRepeatedQuestionRule,
      ``,
      `Stai raccogliendo le informazioni per costruire un percorso personalizzato per ${nameRef}.`,
      teamQuestionInstruction,
      `Se il messaggio di ${nameRef} contiene già dati utili, riconoscili brevemente prima di fare le prossime domande.`,
      planRequest
        ? `Se ${nameRef} vuole un piano completo subito, NON finalizzarlo: raccogli prima i dati mancanti o al massimo anticipa una struttura parziale dichiarata come incompleta.`
        : `Se ${nameRef} vuole consigli senza rispondere: dai consigli con le assunzioni che hai, esplicitandole.`,
    ].join('\n')
  }

  return [
    `Sei un gruppo di specialisti del benessere che segue ${nameRef}.`,
    `Parla in italiano, tono diretto e professionale.${imageNote}`,
    `Rispondi a nome del gruppo usando "noi". Se l'utente chiede esplicitamente chi sta analizzando il suo caso, cita i nomi degli specialisti attivi.`,
    teamAntiPattern,
    teamNoRepetitionRule,
    noFillerRule,
    noRepeatedQuestionRule,
    `Ogni specialista contribuisce solo nel proprio ambito. Non riportare consigli di un dominio attraverso la voce di un altro — ogni indicazione specialistica proviene dallo specialista corretto.`,
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
  /** C1: cross-conversation memory summaries from prior sessions */
  crossConversationContext: string
  /**
   * BUG-A: All missing baseline questions (up to 3 for batch L1, 1 for specialist mode).
   * Replaces the old single `topMissingQuestion` — enables the model to ask multiple
   * baseline questions at once instead of one per turn.
   */
  missingQuestions: string[]
  hasImages: boolean
  planRequest: boolean
  /** F2: ContextPack for structured profile data */
  contextPack: ContextPack
  /** P4: Anti-repetition block listing recent assistant openers */
  antiRepetitionBlock?: string
}): string {
  const {
    userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    crossConversationContext,
    missingQuestions,
    hasImages,
    planRequest,
    contextPack,
    antiRepetitionBlock,
  } = params

  // F2: Structured profile block so the model always sees weight, height, etc.
  const profileBlock = buildStructuredProfileBlock(contextPack)

  // BUG-A: Format missing questions — single question stays inline, multiple shown as bullet list
  const missingQuestionsBlock =
    missingQuestions.length === 1
      ? `\nINFORMAZIONE CHIAVE DA RACCOGLIERE ORA:\n${missingQuestions[0]}`
      : missingQuestions.length > 1
        ? `\nDATI FONDAMENTALI ANCORA MANCANTI (chiedi questi in modo naturale):\n${missingQuestions.map((q) => `• ${q}`).join('\n')}`
        : ''

  // BUG-A + BUG-G: Bottom instruction adapts to batch size
  const closingInstruction =
    planRequest && missingQuestions.length > 0
      ? `L'utente chiede un piano/output definitivo, ma mancano dati fondamentali. NON produrre un documento definitivo. Raccogli prima i dati indicati sopra; se utile, anticipa solo una struttura parziale chiaramente incompleta.`
      : planRequest
        ? `L'utente chiede esplicitamente un piano/output definitivo. Produci un documento professionale completo con dati specifici, ma solo usando dati realmente presenti. Non inventare dettagli mancanti.`
        : missingQuestions.length > 1
          ? `Fai le domande indicate sopra in modo naturale e colloquiale — sono i dati fondamentali del profilo ancora mancanti. Puoi porle insieme brevemente. Non dare altri consigli in questo messaggio.`
          : missingQuestions.length === 1
            ? `Fai la domanda indicata sopra in modo naturale. Non dare consigli in questo messaggio.`
            : `Dai una risposta diretta, concreta e personalizzata basandoti sui dati disponibili.`

  // P5: Build file attachment block for non-image files
  const filesWithContent = (contextPack.files ?? []).filter(
    (f) => f.extractedText && !f.extractedText.startsWith('data:'),
  )
  const fileBlock =
    filesWithContent.length > 0
      ? `ALLEGATI DELL'UTENTE (già inviati — NON chiedere di reinviarli):\n` +
        filesWithContent
          .map((f) => `📎 ${f.filename}:\n${f.extractedText!.slice(0, 3000)}`)
          .join('\n\n')
      : ''

  return [
    // C1: long-term memory from past sessions shown first so model has full context
    crossConversationContext
      ? `MEMORIA SESSIONI PRECEDENTI (conversazioni passate con l'utente):\n${crossConversationContext}\n`
      : '',
    // F2: Structured profile data — always visible before the conversation
    profileBlock ? `${profileBlock}\n` : '',
    // P5: File attachments — documents, PDFs, reports
    fileBlock ? `${fileBlock}\n` : '',
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO DI ${hasImages ? 'UTENTE (con allegato immagine)' : 'UTENTE'}: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries || '(primo contatto — nessun dato sul profilo ancora)',
    topRecommendations ? `\nRACCOMANDAZIONI EMERSE:\n${topRecommendations}` : '',
    missingQuestionsBlock,
    ``,
    antiRepetitionBlock ? `\n${antiRepetitionBlock}` : '',
    `Scrivi la risposta in italiano, rivolta direttamente all'utente.`,
    closingInstruction,
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
  // C1: load cross-conversation long-term memory
  const crossConversationContext = buildCrossConversationContext(input.contextPack)
  // P4: anti-repetition block
  const antiRepetitionBlock = buildAntiRepetitionBlock(input.contextPack)

  const conversationLength = input.contextPack.history.recentMessages.length
  // C3: True only when the user has genuinely never spoken to the system:
  // no messages in the current conversation, no prior-conversation messages, AND
  // no stored summaries from past sessions (built by upsertConversationSummary).
  // M4: Two cross-session mechanisms coexist — crossConversationMessages (contextPackBuilder
  // inline history) and recentConversationSummaries (longTermMemory upsert). Both must be
  // empty for a real first-ever encounter.
  const isFirstMessage =
    conversationLength === 0 &&
    (input.contextPack.history.crossConversationMessages?.length ?? 0) === 0 &&
    (input.contextPack.history.recentConversationSummaries?.length ?? 0) === 0
  const rawHasMissingData = input.gatingQuestions.length > 0 || input.criticalQuestions.length > 0
  // S2: After 6 full exchanges (12 messages), stop asking gating questions and give advice.
  // Was 6 (3 exchanges) which was too aggressive — users could exhaust the budget with 3 short
  // messages and never receive proper onboarding questions.
  const hasMissingData = conversationLength < 12 ? rawHasMissingData : false
  const userName = getUserName(input.contextPack)
  const hasKnownCaseContext =
    conversationLength > 1 ||
    (input.contextPack.history.crossConversationMessages?.length ?? 0) > 0 ||
    (input.contextPack.history.recentConversationSummaries?.length ?? 0) > 0

  // BUG-B: Domain-aware plan request — prevents PT from producing a training plan on a diet request
  const planRequest = input.activeSpecialist
    ? isPlanRequestInSpecialistDomain(input.userMessage, input.activeSpecialist.id)
    : isPlanRequest(input.userMessage)

  // BUG-A: Pass ALL missing questions (up to 3) so baseline can be batched.
  // Previously only gatingQuestions[0] was passed → F4 batching was completely bypassed.
  const rawMissingQuestions =
    input.gatingQuestions.length > 0 ? input.gatingQuestions : input.criticalQuestions.slice(0, 1)
  // When plan requested, still compute count for system prompt but don't block output
  const missingQuestions = hasMissingData ? rawMissingQuestions.slice(0, 3) : []

  const imageData =
    input.imageData ?? (input.contextPack.files ? extractImageData(input.contextPack) : [])
  const hasImages = imageData.length > 0

  const system = buildSystemPrompt(
    input.activeSpecialist,
    isFirstMessage,
    hasMissingData,
    userName,
    hasImages,
    input.proposals,
    missingQuestions.length, // BUG-A: count for singular/plural instruction
    planRequest, // BUG-B: domain-aware flag
    hasKnownCaseContext,
  )
  const user = buildUserPrompt({
    userMessage: input.userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    crossConversationContext, // C1: long-term memory from past sessions
    missingQuestions, // BUG-A: full list replaces single topMissingQuestion
    hasImages,
    planRequest,
    contextPack: input.contextPack, // F2: for structured profile block
    antiRepetitionBlock, // P4: prevent repeated openers
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
