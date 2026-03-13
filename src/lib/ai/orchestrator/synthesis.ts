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
}

export type SynthesisResult = {
  rawText: string
  fallbackUsed: boolean
}

function buildSummaries(proposals: AgentProposal[]): string {
  return proposals
    .filter((proposal) => proposal.summary)
    .sort((left, right) => (right.confidence ?? 0.5) - (left.confidence ?? 0.5))
    .map((proposal) => proposal.summary)
    .join('\n')
}

function buildTopRecommendations(proposals: AgentProposal[]): string {
  return proposals
    .flatMap((proposal) => proposal.recommendations ?? [])
    .slice(0, 3)
    .map(
      (recommendation) =>
        `• ${recommendation.title}: ${recommendation.steps.slice(0, 2).join('; ')}`,
    )
    .join('\n')
}

function buildRecentHistory(contextPack: ContextPack): string {
  return contextPack.history.recentMessages
    .slice(-4)
    .map(
      (message) =>
        `${message.role === 'user' ? 'Utente' : 'Assistente'}: ${message.content.slice(0, 120)}`,
    )
    .join('\n')
}

function buildSystemPrompt(activeSpecialist?: ActiveSpecialist): string {
  if (activeSpecialist) {
    return [
      `Sei ${activeSpecialist.displayName}, specialista del team LiveWell.`,
      `Rispondi in prima persona come ${activeSpecialist.displayName}, con tono professionale e umano, in italiano.`,
      `Stai avendo una conversazione diretta con il tuo paziente/cliente nel tuo ruolo specifico.`,
      ``,
      `REGOLE OBBLIGATORIE:`,
      `- NON usare intestazioni markdown (###, ##, #)`,
      `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
      `- Rispondi come professionista direttamente al paziente/cliente, in prima persona`,
      `- Max 3-4 frasi salvo piani dettagliati esplicitamente richiesti`,
      `- Rimani nel tuo ambito di competenza; per altri ambiti rimanda ai colleghi`,
      `- Per piani o programmi strutturati, usa elenchi numerati senza intestazioni`,
      `- Se manca un dato fondamentale per il tuo ambito, fai UNA sola domanda mirata`,
      `- Evita domande generiche tipo "c'è altro?" o "come ti senti in generale?"`,
      `- Chiudi con domande operative, non con inviti vaghi`,
    ].join('\n')
  }

  return [
    `Sei LiveWell, assistente per il benessere personale che coordina un team di specialisti italiani.`,
    `Parli in italiano, con tono caldo, diretto e professionale — mai generico.`,
    ``,
    `REGOLE OBBLIGATORIE:`,
    `- NON usare intestazioni markdown (###, ##, #)`,
    `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
    `- NON scrivere "Il team sta elaborando..." o promesse di risposte future`,
    `- NON dire che la risposta arriverà in 24-48 ore o simili`,
    `- Rispondi SUBITO con informazioni concrete basate sull'analisi del team`,
    `- Max 3-4 frasi salvo piani dettagliati richiesti dall'utente`,
    `- Se manca un dato critico, fai al massimo UNA domanda di integrazione`,
    `- Evita domande generiche o inviti vaghi`,
    `- Non chiedere informazioni già presenti nel profilo utente`,
    `- Usa il punto fermo, non bullet, per risposte conversazionali brevi`,
    `- Per piani strutturati, usa elenchi numerati senza intestazioni`,
    `- Termina con domande operative mirate solo se mancano dati critici`,
  ].join('\n')
}

function buildUserPrompt(params: {
  userMessage: string
  summaries: string
  topRecommendations: string
  recentHistory: string
  gatingQuestions: string[]
  criticalQuestions: string[]
}): string {
  const {
    userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    gatingQuestions,
    criticalQuestions,
  } = params

  return [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries || '(nessuna analisi disponibile)',
    topRecommendations ? `\nRACCOMANDAZIONI:\n${topRecommendations}` : '',
    gatingQuestions.length
      ? `\nINFORMAZIONI MANCANTI GIÀ EMERSE DAL TEAM: ${gatingQuestions.join('; ')}`
      : '',
    criticalQuestions.length ? `\nUNICO DATO CRITICO MANCANTE: ${criticalQuestions[0]}` : '',
    ``,
    `Scrivi una risposta conversazionale in italiano, rivolta direttamente all'utente.`,
    `Se manca un dato critico, fai solo quella domanda e non aggiungerne altre.`,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildFallbackText(proposals: AgentProposal[]): string {
  return proposals.find((proposal) => proposal.summary)?.summary ?? 'Come posso aiutarti?'
}

export async function synthesizeRawResponse(input: SynthesisInput): Promise<SynthesisResult> {
  const summaries = buildSummaries(input.proposals)
  const topRecommendations = buildTopRecommendations(input.proposals)
  const recentHistory = buildRecentHistory(input.contextPack)
  const system = buildSystemPrompt(input.activeSpecialist)
  const user = buildUserPrompt({
    userMessage: input.userMessage,
    summaries,
    topRecommendations,
    recentHistory,
    gatingQuestions: input.gatingQuestions,
    criticalQuestions: input.criticalQuestions,
  })

  try {
    const res = await input.llm.complete({ system, user, format: 'text' })
    const rawText = res.text.trim()
    if (rawText.startsWith('{') || rawText.startsWith('[')) {
      return { rawText: buildFallbackText(input.proposals), fallbackUsed: true }
    }
    return { rawText, fallbackUsed: false }
  } catch {
    return { rawText: buildFallbackText(input.proposals), fallbackUsed: true }
  }
}
