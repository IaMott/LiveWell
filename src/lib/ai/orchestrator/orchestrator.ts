import {
  AgentProfile,
  AgentInput,
  AgentProposal,
  ConsensusResult,
  ContextPack,
  Domain,
  ActiveSpecialist,
  ToolCall,
} from '../types'
import { detectDomainFromText, detectDomainsMulti } from '../domain/domainDetection'
import { runConsensus } from '../consensus/consensusEngine'
import { applyQuestionPolicy, isGenericQuestion } from '../policy/questionPolicy'
import {
  ageFromIsoDate,
  inferAttributeToolCallsFromMessage,
  isAgeQuestion,
  readPersonalSnapshot,
} from './inputInference'
import { buildAgentUserPrompt } from './agentPrompt'
import { buildDomainDetectedTraceEvent } from './decisionTrace'
import { normalizeAgentProposal } from './proposalNormalization'
import { resolveRoutingContext } from './routing'
import { getServerEnv } from '@/lib/validators/env'

export type LlmClient = {
  complete: (args: {
    system: string
    user: string
    jsonSchema?: unknown
    stream?: boolean
    format?: 'json' | 'text'
  }) => Promise<{ text: string }>
}

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

function buildSingleMissingQuestion(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
): string | null {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()
  const personal = readPersonalSnapshot(contextPack)

  if (isAgeQuestion(userMessage) && !personal.birthDate) {
    return 'Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).'
  }

  const hasAttr = (d: keyof typeof attrs, key: string): boolean => {
    const bucket = attrs[d] as Record<string, { value?: unknown }> | undefined
    return Boolean(bucket?.[key]?.value != null)
  }

  if (domain === 'nutrition' || lower.includes('dieta') || lower.includes('aliment')) {
    if (!hasAttr('nutrition', 'allergy') && !hasAttr('health', 'allergy')) {
      return 'Hai allergie o intolleranze alimentari da registrare?'
    }
    if (!hasAttr('nutrition', 'goal') && !hasAttr('general', 'goal')) {
      return 'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?'
    }
    return null
  }

  if (domain === 'training') {
    if (!hasAttr('training', 'training_frequency_per_week')) {
      return 'Quanti allenamenti a settimana riesci a fare realisticamente?'
    }
    return null
  }

  if (domain === 'health') {
    if (!hasAttr('health', 'symptom_duration')) {
      return 'Da quanto tempo è presente il sintomo principale?'
    }
    return null
  }

  if (domain === 'mindfulness') {
    if (!hasAttr('mindfulness', 'stress_level')) {
      return 'Su una scala 0-10, quanto è il tuo livello di stress medio?'
    }
    return null
  }

  return null
}

function buildQuestionPlan(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
): string[] {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()
  const personal = readPersonalSnapshot(contextPack)
  const plan: string[] = []

  const hasAttr = (d: keyof typeof attrs, key: string): boolean => {
    const bucket = attrs[d] as Record<string, { value?: unknown }> | undefined
    return Boolean(bucket?.[key]?.value != null)
  }

  if (isAgeQuestion(userMessage) && !personal.birthDate) {
    plan.push('Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).')
  }

  if (domain === 'nutrition' || lower.includes('dieta') || lower.includes('aliment')) {
    if (!hasAttr('nutrition', 'allergy') && !hasAttr('health', 'allergy')) {
      plan.push('Hai allergie o intolleranze alimentari da registrare?')
    }
    if (!hasAttr('nutrition', 'goal') && !hasAttr('general', 'goal')) {
      plan.push('Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?')
    }
    return plan
  }

  if (domain === 'training') {
    if (!hasAttr('training', 'training_frequency_per_week')) {
      plan.push('Quanti allenamenti a settimana riesci a fare realisticamente?')
    }
    if (!hasAttr('training', 'injury')) {
      plan.push('Hai infortuni o limitazioni fisiche attive da considerare nel piano?')
    }
    return plan
  }

  if (domain === 'health') {
    if (!hasAttr('health', 'symptom_duration')) {
      plan.push('Da quanto tempo è presente il sintomo principale?')
    }
    if (!hasAttr('health', 'diagnosis')) {
      plan.push('Hai già una diagnosi medica confermata o esami recenti disponibili?')
    }
    return plan
  }

  if (domain === 'mindfulness') {
    if (!hasAttr('mindfulness', 'stress_level')) {
      plan.push('Su una scala 0-10, quanto è il tuo livello di stress medio?')
    }
    if (!hasAttr('mindfulness', 'sleep_hours')) {
      plan.push('Quante ore dormi mediamente per notte?')
    }
    return plan
  }

  return plan
}

function getPendingQuestionsFromWorkspace(
  contextPack: ContextPack,
  domain: Domain,
  activeSpecialist?: ActiveSpecialist,
): string[] {
  const workspaces = contextPack.history.agentWorkspaces ?? []
  const selected = workspaces
    .filter((w) => {
      if (activeSpecialist && w.agentId === activeSpecialist.id) return true
      if (w.pendingDomain && w.pendingDomain === domain) return true
      return false
    })
    .flatMap((w) => w.pendingQuestions ?? [])
    .map((q) => q.trim())
    .filter((q) => q.length > 0)

  const seen = new Set<string>()
  return selected.filter((q) => {
    const k = q.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function buildInterviewQueue(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
  activeSpecialist?: ActiveSpecialist,
): { askNow: string[]; pendingNext: string[] } {
  const fromWorkspace = getPendingQuestionsFromWorkspace(contextPack, domain, activeSpecialist)
  const fromPlan = buildQuestionPlan(domain, contextPack, userMessage)
  const workspaceQueue = fromWorkspace
    .map((question) => question.trim())
    .filter((question) => question.length > 0 && !isGenericQuestion(question))

  const seenWorkspace = new Set<string>()
  const orderedWorkspace = workspaceQueue.filter((question) => {
    const key = question.toLowerCase()
    if (seenWorkspace.has(key)) return false
    seenWorkspace.add(key)
    return true
  })

  const policy = applyQuestionPolicy(
    fromPlan
      .filter((question) => !seenWorkspace.has(question.trim().toLowerCase()))
      .map((question) => ({ question, priority: 10 })),
    { domain, maxQuestions: Math.max(0, 1 - orderedWorkspace.length), dedupeStrategy: 'exact' },
  )

  const orderedQuestions = [...orderedWorkspace, ...policy.orderedQuestions]
  if (orderedQuestions.length === 0) return { askNow: [], pendingNext: [] }
  return {
    askNow: orderedQuestions.slice(0, 1),
    pendingNext: orderedQuestions.slice(1),
  }
}

function buildCriticalQuestions(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
  _activeSpecialist?: ActiveSpecialist,
): string[] {
  const q = buildSingleMissingQuestion(domain, contextPack, userMessage)
  if (!q || isGenericQuestion(q)) return []
  return [q]
}

function mergeInterviewQuestions(existing: string[], critical: string[]): string[] {
  return applyQuestionPolicy(
    [
      ...existing.map((question) => ({ question, priority: 20 })),
      ...critical.map((question) => ({ question, priority: 10 })),
    ],
    { domain: 'general', maxQuestions: 1, dedupeStrategy: 'exact' },
  ).orderedQuestions
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

async function runOneAgent(
  llm: LlmClient,
  agent: AgentProfile,
  input: AgentInput,
  peerInsights?: string,
): Promise<AgentProposal> {
  const userPrompt = buildAgentUserPrompt(input, agent.id, peerInsights)

  const res = await llm.complete({
    system: agent.systemPrompt,
    user: userPrompt,
  })

  const fallbackToolCalls = inferAttributeToolCallsFromMessage(input.message, {
    domainHint: input.domainHint ?? 'general',
  })

  return normalizeAgentProposal({
    text: res.text,
    agentId: agent.id,
    domainHint: input.domainHint ?? 'general',
    fallbackToolCalls,
  })
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

  const round1Proposals = await Promise.all(
    selectedAgents.map((a) => runOneAgent(deps.llm, a, { ...input, domainHint })),
  )

  const round2Proposals = await Promise.all(
    selectedAgents.map((agent) => {
      const peerInsights = round1Proposals
        .filter((p) => p.agentId !== agent.id)
        .slice(0, 3)
        .map((p) => `- ${p.agentId}: ${p.summary}`)
        .join('\n')
      return runOneAgent(deps.llm, agent, { ...input, domainHint }, peerInsights || undefined)
    }),
  )

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals: round2Proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })

  const queue = buildInterviewQueue(domainHint, input.contextPack, input.message, activeSpecialist)
  const interviewCriticalQuestions = buildCriticalQuestions(
    domainHint,
    input.contextPack,
    input.message,
    activeSpecialist,
  )
  const mergedInterviewQuestions = mergeInterviewQuestions(
    consensus.gatingQuestions ?? [],
    queue.askNow.length > 0 ? queue.askNow : interviewCriticalQuestions,
  )
  const finalInterviewQuestions = mergedInterviewQuestions.slice(0, 1)

  const round2WithQueue: AgentProposal[] = round2Proposals.map((p, idx) => {
    const shouldOwnQueue = activeSpecialist?.id === p.agentId || (!activeSpecialist && idx === 0)
    if (!shouldOwnQueue) return p
    return {
      ...p,
      pendingDomain: domainHint,
      pendingQuestions: queue.pendingNext,
    }
  })

  const hasQueueOwner = round2WithQueue.some((p) => Array.isArray(p.pendingQuestions))
  const round2ForPersistence =
    !hasQueueOwner && queue.pendingNext.length > 0
      ? [
          ...round2WithQueue,
          {
            agentId: activeSpecialist?.id ?? 'orchestratore',
            domain: domainHint,
            summary: 'Interview queue state',
            reasoning: 'Persisted pending interview follow-up questions.',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 1,
            pendingDomain: domainHint,
            pendingQuestions: queue.pendingNext,
          } satisfies AgentProposal,
        ]
      : round2WithQueue

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
