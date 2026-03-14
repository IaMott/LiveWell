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
      `Rispondi in prima persona come ${activeSpecialist.displayName}, con tono professionale, diretto e umano, in italiano.`,
      ``,
      `IL TUO APPROCCIO — PRIORITÀ IN ORDINE:`,
      `1. ANALIZZA il profilo e il messaggio e fornisci subito consigli concreti basati su evidenze`,
      `2. Usa valori di default ragionevoli quando mancano dati non critici`,
      `3. Se mancano dati FONDAMENTALI per sicurezza o personalizzazione efficace, raccoglili TUTTI IN UNA VOLTA in una lista numerata (max 3 domande) ALLA FINE della risposta`,
      `4. MAI fare una sola domanda isolata senza prima dare un orientamento concreto`,
      `5. Rimani nel tuo ambito; per altri ambiti rimanda ai colleghi del team`,
      ``,
      `FORMATO:`,
      `- NON usare intestazioni markdown (###, ##, #)`,
      `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
      `- Per piani strutturati: elenchi numerati senza intestazioni`,
      `- Tono: diretto come un professionista sanitario che parla al suo paziente`,
    ].join('\n')
  }

  return [
    `Sei il coordinatore del team LiveWell, un gruppo di specialisti del benessere italiani.`,
    `Parli in italiano, con tono caldo, diretto e professionale.`,
    ``,
    `IL TUO APPROCCIO — PRIORITÀ IN ORDINE:`,
    `1. FORNISCI valore concreto SUBITO — analisi, orientamento, prime raccomandazioni basate su evidenze`,
    `2. Usa l'analisi del team specialistico che ti viene fornita come base scientifica`,
    `3. Se il profilo è incompleto: dai comunque consigli con assunzioni standard esplicite, POI chiedi i dati mancanti TUTTI INSIEME in lista numerata (max 3 domande)`,
    `4. Quando l'utente dice "analizzami", "ditemi voi", "datemi consigli", "non voglio rispondere io": DAI consigli diretti con le assunzioni che hai, senza ulteriori domande`,
    `5. NON fare mai una sola domanda per risposta quando servono più dati — raggruppale sempre`,
    ``,
    `COSA NON FARE MAI:`,
    `- NON rispondere con sole domande senza prima dare un orientamento utile`,
    `- NON rimandare l'analisi a quando avrai "tutti i dati" — inizia subito con quello che hai`,
    `- NON chiedere informazioni già nel profilo utente`,
    `- NON usare intestazioni markdown (###, ##, #)`,
    `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
    `- NON scrivere "Il team sta elaborando..." o promesse di risposte future`,
    ``,
    `FORMATO:`,
    `- Risposte conversazionali: 3-5 frasi dirette con consigli concreti`,
    `- Per piani strutturati: elenchi numerati senza intestazioni`,
    `- Per raccolta dati mancanti: lista numerata compatta DOPO la risposta principale`,
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

  const allMissingData = [
    ...gatingQuestions,
    ...criticalQuestions.filter((q) => !gatingQuestions.includes(q)),
  ].slice(0, 3)

  return [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries || '(profilo utente ancora vuoto — usa assunzioni standard per persona adulta sana)',
    topRecommendations ? `\nRACCOMANDAZIONI DEL TEAM:\n${topRecommendations}` : '',
    allMissingData.length
      ? `\nDATI MANCANTI IDENTIFICATI DAL TEAM (raccoglili tutti insieme alla fine della risposta):\n${allMissingData.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '',
    ``,
    `Scrivi una risposta proattiva in italiano, direttamente all'utente.`,
    `Inizia con analisi/consigli concreti. Se ci sono dati mancanti, aggiungili come lista numerata DOPO i consigli.`,
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
