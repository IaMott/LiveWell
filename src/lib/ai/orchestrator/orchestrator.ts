import {
  AgentProfile,
  AgentInput,
  AgentProposal,
  ConsensusResult,
  ContextPack,
  ActiveSpecialist,
  ToolCall,
} from '../types'
import { detectDomainFromText, detectDomainsMulti } from '../domain/domainDetection'
import { runConsensus } from '../consensus/consensusEngine'
import {
  ageFromIsoDate,
  isAgeQuestion,
  readPersonalSnapshot,
  inferAttributeToolCallsFromMessage,
} from './inputInference'
import { LlmClient } from './agentExecution'
import { executeAgentRounds } from './agentRoundExecution'
import { buildDomainDetectedTraceEvent } from './decisionTrace'
import { applyInterviewFlow } from './interviewFlow'
import { resolveRoutingContext } from './routing'
import { getServerEnv } from '@/lib/validators/env'

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
  retryGuardWindowMs?: number
}

const NON_RETRIABLE_TOOL_ERROR_CODES = new Set([
  'TOOL_FORBIDDEN_BY_AGENT_CAPABILITY',
  'FORBIDDEN',
  'OWNER_MODE_REQUIRED',
  'VALIDATION_ERROR',
])

function getRetryGuardWindowMs(): number {
  const env = getServerEnv()
  return env.ORCH_RETRY_GUARD_WINDOW_MS ?? 2 * 60 * 1000
}

function filterNonRetriableToolCallsFromRecentTrace(
  toolCalls: ToolCall[],
  contextPack: ContextPack,
  retryGuardWindowMs: number,
): { kept: ToolCall[]; blocked: ToolCall[] } {
  const trace = contextPack.history.toolExecutionTrace ?? []
  if (trace.length === 0 || toolCalls.length === 0) {
    return { kept: toolCalls, blocked: [] }
  }

  const now = Date.now()
  const recentBlockingToolNames = new Set(
    trace
      .filter((t) => {
        if (t.ok) return false
        if (!t.code || !NON_RETRIABLE_TOOL_ERROR_CODES.has(t.code)) return false
        const ageMs = now - new Date(t.createdAt).getTime()
        return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= retryGuardWindowMs
      })
      .map((t) => t.name),
  )

  if (recentBlockingToolNames.size === 0) {
    return { kept: toolCalls, blocked: [] }
  }

  const blocked = toolCalls.filter((c) => recentBlockingToolNames.has(c.name))
  const kept = toolCalls.filter((c) => !recentBlockingToolNames.has(c.name))
  return { kept, blocked }
}

function hasEquivalentQuestionInText(text: string, question: string): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4)
  const textTokens = new Set(clean(text))
  const qTokens = clean(question)
  if (qTokens.length === 0) return false
  const overlap = qTokens.filter((t) => textTokens.has(t)).length
  return overlap >= Math.max(2, Math.ceil(qTokens.length * 0.5))
}

function ensureCriticalQuestionsInText(text: string, questions: string[]): string {
  if (questions.length === 0) return text
  const missing = questions.filter((q) => !hasEquivalentQuestionInText(text, q))
  if (missing.length === 0) return text
  return `${text.trim()}\n\nMi manca solo questo dato per risponderti meglio: ${missing[0]}`
}

async function synthesizeResponse(
  llm: LlmClient,
  params: {
    userMessage: string
    proposals: AgentProposal[]
    gatingQuestions: string[]
    criticalQuestions: string[]
    contextPack: ContextPack
    activeSpecialist?: ActiveSpecialist
  },
): Promise<string> {
  const {
    userMessage,
    proposals,
    gatingQuestions,
    criticalQuestions,
    contextPack,
    activeSpecialist,
  } = params

  const summaries = proposals
    .filter((p) => p.summary)
    .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
    .map((p) => p.summary)
    .join('\n')

  const topRecs = proposals
    .flatMap((p) => p.recommendations ?? [])
    .slice(0, 3)
    .map((r) => `• ${r.title}: ${r.steps.slice(0, 2).join('; ')}`)
    .join('\n')

  const recentHistory = contextPack.history.recentMessages
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content.slice(0, 120)}`)
    .join('\n')

  let systemPrompt: string
  if (activeSpecialist) {
    systemPrompt = [
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
  } else {
    systemPrompt = [
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

  const userPrompt = [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries || '(nessuna analisi disponibile)',
    topRecs ? `\nRACCOMANDAZIONI:\n${topRecs}` : '',
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

  try {
    const res = await llm.complete({ system: systemPrompt, user: userPrompt, format: 'text' })
    const text = res.text.trim()
    // Fallback if model accidentally returned JSON
    if (text.startsWith('{') || text.startsWith('[')) {
      const fallback = proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
      return ensureCriticalQuestionsInText(fallback, criticalQuestions)
    }
    return ensureCriticalQuestionsInText(text, criticalQuestions)
  } catch {
    const fallback = proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
    return ensureCriticalQuestionsInText(fallback, criticalQuestions)
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const personal = readPersonalSnapshot(input.contextPack)
  if (isAgeQuestion(input.message)) {
    const age = personal.birthDate ? ageFromIsoDate(personal.birthDate) : null
    const response =
      age != null
        ? `Hai ${age} anni.`
        : 'Non ho la tua data di nascita registrata. Per calcolare la tua età indicami la data di nascita in formato gg/mm/aaaa.'
    return {
      domain: 'general',
      finalMessageMarkdown: response,
      toolCallsToExecute: inferAttributeToolCallsFromMessage(input.message, {
        domainHint: 'general',
      }),
      ui: {
        domainIcon: 'general',
        moodScore: input.contextPack.ui.moodScore,
        sectionScores: input.contextPack.ui.sectionScores,
      },
      gatingQuestions:
        age == null
          ? ['Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).']
          : undefined,
      safety: { escalation: 'none' },
      artifactsToSave: undefined,
      activeSpecialist: input.activeSpecialistId
        ? {
            id: input.activeSpecialistId,
            displayName: input.activeSpecialistId,
            domain: 'general',
          }
        : undefined,
      debug: { selectedAgents: [], conflicts: [] },
    }
  }

  const detectedDomain = input.domainHint ?? detectDomainFromText(input.message)
  const allDomains = detectDomainsMulti(input.message).map((d) => d.domain)
  const decisionTrace = [
    buildDomainDetectedTraceEvent({
      step: 1,
      detectedDomain,
      allDomains,
      source: input.domainHint ? 'input.domainHint' : 'domainDetection',
    }),
  ]
  const {
    activeSpecialist,
    domainHint,
    selectedAgents,
    decisionTrace: routingDecisionTrace,
  } = resolveRoutingContext({
    team: deps.team,
    message: input.message,
    detectedDomain,
    allDomains,
    activeSpecialistId: input.activeSpecialistId,
  })
  decisionTrace.push(...routingDecisionTrace)

  const { round1Proposals, round2Proposals } = await executeAgentRounds({
    llm: deps.llm,
    selectedAgents,
    input,
    domainHint,
  })

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals: round2Proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })

  const { finalInterviewQuestions, round2WithQueue, round2ForPersistence } = applyInterviewFlow({
    domain: domainHint,
    contextPack: input.contextPack,
    userMessage: input.message,
    consensusGatingQuestions: consensus.gatingQuestions ?? [],
    round2Proposals,
    activeSpecialist,
  })

  const naturalResponse = await synthesizeResponse(deps.llm, {
    userMessage: input.message,
    proposals: round2WithQueue,
    gatingQuestions: finalInterviewQuestions,
    criticalQuestions: finalInterviewQuestions,
    contextPack: input.contextPack,
    activeSpecialist,
  })

  // Deterministic safeguard: if specialists/LLM fail to emit tool-calls,
  // still persist clearly extractable personal data from user text.
  const fallbackToolCalls = inferAttributeToolCallsFromMessage(input.message, {
    domainHint,
    activeSpecialist,
  })
  const mergedToolCalls = [...(consensus.toolCallsToExecute ?? []), ...fallbackToolCalls]
  const dedupedToolCalls = mergedToolCalls.filter((c, idx, arr) => {
    const key = `${c.name}:${JSON.stringify(c.args)}`
    return arr.findIndex((x) => `${x.name}:${JSON.stringify(x.args)}` === key) === idx
  })
  const retryGuardWindowMs =
    typeof deps.retryGuardWindowMs === 'number' && deps.retryGuardWindowMs > 0
      ? deps.retryGuardWindowMs
      : getRetryGuardWindowMs()
  const filteredByTrace = filterNonRetriableToolCallsFromRecentTrace(
    dedupedToolCalls,
    input.contextPack,
    retryGuardWindowMs,
  )

  return {
    ...consensus,
    gatingQuestions: finalInterviewQuestions,
    toolCallsToExecute: filteredByTrace.kept,
    finalMessageMarkdown: naturalResponse,
    activeSpecialist,
    debug: {
      selectedAgents: consensus.debug?.selectedAgents ?? selectedAgents.map((a) => a.id),
      conflicts: [
        ...(consensus.debug?.conflicts ?? []),
        ...(filteredByTrace.blocked.length > 0
          ? [
              `Blocked ${filteredByTrace.blocked.length} non-retriable tool call(s) from recent trace`,
            ]
          : []),
      ],
      decisionTrace,
      blockedToolCalls: filteredByTrace.blocked,
      proposals: round2ForPersistence,
      round1Proposals,
      round2Proposals: round2ForPersistence,
    },
  }
}
