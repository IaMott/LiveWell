import { ActiveSpecialist, AgentProposal, ContextPack, Domain } from '../types'
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

    // Virtual-team rule — specialists are virtual agents, no appointments, no invented names
    const virtualTeamRule = `REGOLA FONDAMENTALE: Gli specialisti del team LiveWell sono agenti virtuali presenti in questa conversazione ADESSO. Non esistono agende, disponibilità da verificare o appuntamenti da fissare. Non inventare mai nomi propri di professionisti reali (es. "Dr. Bianchi", "Dr.ssa Ricci") — gli specialisti si identificano con il loro ruolo. Quando il percorso richiede un altro specialista, la conversazione passa DIRETTAMENTE a quello specialista — senza passaggi intermedi, senza scheduling, senza simulare processi di prenotazione.`

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
        virtualTeamRule,
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
        virtualTeamRule,
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
      virtualTeamRule,
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

  // Virtual-team rule — same constraint for team mode
  const teamVirtualRule = `REGOLA FONDAMENTALE: Gli specialisti del team LiveWell sono agenti virtuali presenti in questa conversazione ADESSO. Non esistono agende, disponibilità da verificare o appuntamenti da fissare. Non inventare mai nomi propri di professionisti reali. Quando il percorso richiede uno specialista specifico, la conversazione passa DIRETTAMENTE a quello specialista — senza scheduling, senza simulare processi di prenotazione.`

  if (isFirstMessage) {
    return [
      `Sei un gruppo di specialisti del benessere (medici, nutrizionisti, personal trainer, psicologi, fisioterapisti) che segue ${nameRef}.`,
      `Parla in italiano, tono caldo e diretto — come persone reali, non come un chatbot aziendale.${imageNote}`,
      `Rispondi a nome del gruppo usando "noi". NON presentarti come singolo specialista.`,
      teamAntiPattern,
      teamVirtualRule,
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
      teamVirtualRule,
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
    teamVirtualRule,
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
  const INLINE_MIME_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'text/markdown']
  const allContextFiles = contextPack.files ?? []
  const filesWithContent = allContextFiles.filter(
    (f) => f.extractedText && !f.extractedText.startsWith('data:'),
  )
  // Files passed as inline multimodal data (images with data: URI, or PDFs/docs with URL)
  const filesPassedInline = allContextFiles.filter(
    (f) =>
      (f.mimeType?.startsWith('image/') && f.extractedText?.startsWith('data:')) ||
      (INLINE_MIME_TYPES.includes(f.mimeType ?? '') && f.url && !f.extractedText),
  )
  const inlineFilenames = new Set(filesPassedInline.map((f) => f.filename))
  // Only warn about files that are truly unreadable (no content AND not passed inline)
  const filesWithoutContent = allContextFiles.filter(
    (f) => !f.extractedText && !f.url && !inlineFilenames.has(f.filename),
  )

  let fileBlock = ''
  if (filesWithContent.length > 0) {
    fileBlock +=
      `ALLEGATI DELL'UTENTE (testo estratto — usa questi dati reali):\n` +
      filesWithContent
        .map((f) => `📎 ${f.filename}:\n${f.extractedText!.slice(0, 3000)}`)
        .join('\n\n') +
      `\n\nISTRUZIONE ALLEGATI: Comportati come un professionista che riceve un documento dal proprio paziente/cliente. Analizza il contenuto, formula una valutazione professionale basata sui dati presenti (valori, date, diagnosi, farmaci, misure, referti) e integra quella valutazione nella tua risposta. Non limitarti a dichiarare di aver ricevuto il documento — esprimi il tuo parere professionale sul suo contenuto, come faresti leggendolo in studio.`
  }
  if (filesPassedInline.length > 0) {
    const inlineNames = filesPassedInline.map((f) => `📎 ${f.filename}`).join('\n')
    fileBlock +=
      (fileBlock ? '\n\n' : '') +
      `ALLEGATI PASSATI DIRETTAMENTE AL MODELLO (immagini/PDF inline):\n${inlineNames}\n` +
      `ISTRUZIONE: Analizza il contenuto di questi file direttamente — li stai ricevendo come dati multimediali. Fornisci una valutazione professionale basata su ciò che vedi/leggi.`
  }
  if (filesWithoutContent.length > 0) {
    // ANTI-HALLUCINATION: the synthesis LLM must NOT invent document content
    fileBlock +=
      (fileBlock ? '\n\n' : '') +
      `⚠️ DOCUMENTI ALLEGATI SENZA CONTENUTO ESTRATTO (il sistema NON ha potuto leggere questi file):\n` +
      filesWithoutContent.map((f) => `📎 ${f.filename}`).join('\n') +
      `\n\nREGOLA ASSOLUTA: Per i documenti elencati sopra il contenuto NON è disponibile. NON dichiarare di aver letto questi documenti. NON inventare dati, diagnosi, valori o localizzazioni presenti in essi. Se l'utente chiede informazioni contenute in questi documenti, rispondi: "Non ho potuto leggere automaticamente il documento — puoi descrivermi i dati rilevanti?" Non usare esempi (es. C5-C6) come se fossero fatti reali.`
  }

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

/**
 * Extract inline file data for Gemini multimodal from contextPack files.
 * Handles images (stored as data: URIs in extractedText) and PDFs/documents
 * (fetched from Vercel Blob URL and converted to base64).
 */
export async function extractInlineFileData(
  contextPack: ContextPack,
): Promise<Array<{ mimeType: string; data: string }>> {
  const files = contextPack.files ?? []
  const results: Array<{ mimeType: string; data: string }> = []

  for (const f of files) {
    // Images: already stored as data: URIs in extractedText
    if (f.mimeType?.startsWith('image/') && f.extractedText?.startsWith('data:')) {
      const raw = f.extractedText
      const comma = raw.indexOf(',')
      const header = raw.slice(0, comma) // "data:image/jpeg;base64"
      const mimeType = header.split(':')[1]?.split(';')[0] ?? f.mimeType
      const data = raw.slice(comma + 1)
      results.push({ mimeType, data })
      continue
    }

    // PDFs and other supported documents: fetch from Blob URL, convert to base64
    const INLINE_MIME_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'text/markdown']
    const mime = f.mimeType ?? ''
    if (INLINE_MIME_TYPES.includes(mime) && f.url && !f.extractedText) {
      try {
        const response = await fetch(f.url)
        if (response.ok) {
          const buffer = await response.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          results.push({ mimeType: mime, data: base64 })
        }
      } catch {
        // Silently skip — the "filesWithoutContent" warning will still cover this
      }
      continue
    }
  }

  return results
}

/** @deprecated Use extractInlineFileData (async) instead */
export function extractImageData(
  contextPack: ContextPack,
): Array<{ mimeType: string; data: string }> {
  return (contextPack.files ?? [])
    .filter((f) => f.mimeType?.startsWith('image/') && f.extractedText?.startsWith('data:'))
    .map((f) => {
      const raw = f.extractedText!
      const comma = raw.indexOf(',')
      const header = raw.slice(0, comma)
      const mimeType = header.split(':')[1]?.split(';')[0] ?? f.mimeType
      const data = raw.slice(comma + 1)
      return { mimeType, data }
    })
}

/**
 * Per-agent synthesis: generates a separate response for each relevant specialist.
 * Used when ≥2 agents have meaningful contributions (confidence > 0.3).
 * Each agent gets its own LLM call to produce a first-person response.
 */
export type AgentSynthesisResult = {
  agentId: string
  agentName: string
  domain: Domain
  content: string
}

export async function synthesizePerAgentResponses(input: {
  llm: LlmClient
  proposals: AgentProposal[]
  userMessage: string
  contextPack: ContextPack
  team: Array<{ id: string; displayName: string; domainTags: string[] }>
}): Promise<AgentSynthesisResult[]> {
  const { llm, proposals, userMessage, contextPack, team } = input

  // Only relevant proposals (confidence > 0.3, non-unavailable)
  const relevant = proposals
    .filter(
      (p) =>
        (p.confidence ?? 0) > 0.3 &&
        p.summary &&
        !p.summary.toLowerCase().includes('[unavailable]'),
    )
    .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
    .slice(0, 4)

  if (relevant.length < 2) return [] // Not enough for multi-agent mode

  const userName = getUserName(contextPack)
  const nameRef = userName ?? "l'utente"
  const recentHistory = buildRecentHistory(contextPack)

  // Build peer summaries for cross-reference
  const peerSummaries = relevant
    .map((p) => {
      const agent = team.find((a) => a.id === p.agentId)
      return `${agent?.displayName ?? p.agentId}: ${p.summary}`
    })
    .join('\n')

  const results = await Promise.allSettled(
    relevant.map(async (proposal) => {
      const agent = team.find((a) => a.id === proposal.agentId)
      const agentName = agent?.displayName ?? proposal.agentId

      const system = [
        `Sei ${agentName} del team LiveWell. Stai rispondendo a ${nameRef}.`,
        `Parla in italiano, prima persona singolare (io). Tono diretto e professionale.`,
        `NON usare mai nomi propri inventati. NON iniziare con "Ciao, sono il/la ${agentName}".`,
        `Rispondi SOLO nel tuo dominio di competenza. Sii conciso: max 150 parole.`,
        `Se suggerisci di consultare un altro specialista, dillo brevemente a fine risposta.`,
      ].join('\n')

      const user = [
        recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
        `MESSAGGIO UTENTE: "${userMessage}"`,
        ``,
        `LA TUA ANALISI (round 2):`,
        proposal.summary,
        proposal.reasoning ? `\nRAGIONAMENTO: ${proposal.reasoning}` : '',
        proposal.questions?.length ? `\nDOMANDE DA PORRE: ${proposal.questions.join('; ')}` : '',
        ``,
        `CONTRIBUTI DEI COLLEGHI:`,
        peerSummaries,
        ``,
        `Scrivi la tua risposta personale basata sulla tua analisi. Sii specifico e utile.`,
        `Se i colleghi hanno punti rilevanti, puoi integrarli brevemente nel tuo ambito.`,
      ]
        .filter(Boolean)
        .join('\n')

      const agentFileData = await extractInlineFileData(contextPack)
      const res = await llm.complete({ system, user, format: 'text', imageData: agentFileData })
      const content = res.text.trim()

      // If LLM returned JSON instead of text, extract summary
      if (content.startsWith('{')) {
        try {
          const obj = JSON.parse(content)
          return {
            agentId: proposal.agentId,
            agentName,
            domain: proposal.domain,
            content: String(obj.summary ?? obj.content ?? proposal.summary),
          }
        } catch {
          return {
            agentId: proposal.agentId,
            agentName,
            domain: proposal.domain,
            content: proposal.summary,
          }
        }
      }

      return { agentId: proposal.agentId, agentName, domain: proposal.domain, content }
    }),
  )

  const fulfilled: AgentSynthesisResult[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.content.length > 10) {
      fulfilled.push(r.value)
    }
  }
  return fulfilled
}

export async function synthesizeRawResponse(input: SynthesisInput): Promise<SynthesisResult> {
  // Cap proposals to prevent excessively long synthesis prompts (max 6 agents)
  const cappedProposals = input.proposals.slice(0, 6)
  const summaries = buildSummaries(cappedProposals)
  const topRecommendations = buildTopRecommendations(cappedProposals)
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
    input.imageData ??
    (input.contextPack.files ? await extractInlineFileData(input.contextPack) : [])
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
