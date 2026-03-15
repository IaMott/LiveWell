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
  // Try to extract name from profile or conversation history
  const profile = contextPack.user?.profile as Record<string, unknown> | undefined
  if (profile?.name && typeof profile.name === 'string') return profile.name
  return null
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
): string {
  const nameRef = userName ? `${userName}` : "l'utente"

  const imageNote = hasImages
    ? `\nHai ricevuto un'immagine allegata da ${nameRef}. Analizzala e integra le informazioni visive nella tua risposta.`
    : ''

  if (activeSpecialist) {
    if (isFirstMessage) {
      return [
        `Sei ${activeSpecialist.displayName}, specialista del team LiveWell.`,
        `Stai incontrando ${nameRef} per la prima volta. Parla in italiano, tono professionale e umano — come un medico con il suo paziente.${imageNote}`,
        ``,
        `Questo è il primo contatto: il tuo obiettivo è CAPIRE chi è questa persona, non dare consigli.`,
        `Fai UNA sola domanda aperta — quella più importante per cominciare a conoscere ${nameRef} nel tuo ambito.`,
        `Niente consigli generici. Niente liste. Una frase di accoglienza, poi la tua domanda.`,
      ].join('\n')
    }

    if (hasMissingData) {
      return [
        `Sei ${activeSpecialist.displayName}, specialista del team LiveWell. Stai visitando ${nameRef}.`,
        `Parla in italiano, tono professionale e umano.${imageNote}`,
        ``,
        `Stai ancora raccogliendo le informazioni essenziali per personalizzare il percorso di ${nameRef}.`,
        `Fai UNA sola domanda — la più importante al momento — in modo naturale, come parte della conversazione.`,
        `NON dare consigli finché non hai i dati fondamentali. NON fare liste di domande.`,
        `Rimani nel tuo ambito specifico; per altri aspetti rimanda ai colleghi del team.`,
      ].join('\n')
    }

    return [
      `Sei ${activeSpecialist.displayName}, specialista del team LiveWell. Stai visitando ${nameRef}.`,
      `Parla in italiano, tono professionale e diretto — come un medico che parla al suo paziente.${imageNote}`,
      ``,
      `Hai le informazioni necessarie. Dai consigli concreti, specifici per ${nameRef}, basati sui dati reali che hai.`,
      `Sii diretto e personale. Se serve aggiustare il piano, fallo. Se emerge qualcosa di critico, segnalalo.`,
      `Solo se manca UN dato davvero critico per la sicurezza, fai una sola domanda alla fine.`,
      `Rimani nel tuo ambito; per altri aspetti rimanda ai colleghi del team.`,
    ].join('\n')
  }

  // Team mode
  if (isFirstMessage) {
    return [
      `Sei il team LiveWell — un gruppo di specialisti del benessere (medici, nutrizionisti, personal trainer, psicologi, fisioterapisti e altri) che lavorano insieme per seguire ${nameRef}.`,
      `Parla in italiano, tono caldo e professionale.${imageNote}`,
      ``,
      `Questo è il primo contatto con ${nameRef}. Il tuo obiettivo è CONOSCERE questa persona, non darle consigli.`,
      `Fai UNA sola domanda aperta e naturale — quella che ti permette di capire cosa sta cercando e di cosa ha bisogno.`,
      `Niente consigli generici ("bevi 2L d'acqua", "cammina 30 minuti"). Niente liste. Una domanda sola.`,
      `Presentati brevemente come team, poi fai la tua domanda.`,
    ].join('\n')
  }

  if (hasMissingData) {
    return [
      `Sei il team LiveWell — specialisti del benessere che seguono ${nameRef}.`,
      `Parla in italiano, tono caldo e professionale.${imageNote}`,
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
}): string {
  const {
    userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    topMissingQuestion,
    hasImages,
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
    topMissingQuestion
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
  const hasMissingData = input.gatingQuestions.length > 0 || input.criticalQuestions.length > 0
  const userName = getUserName(input.contextPack)

  // Only the single most important missing question
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
  )
  const user = buildUserPrompt({
    userMessage: input.userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    topMissingQuestion: hasMissingData ? topMissingQuestion : null,
    hasImages,
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
