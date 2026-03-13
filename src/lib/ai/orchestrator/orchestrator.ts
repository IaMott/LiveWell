import { AgentProfile, AgentInput, ConsensusResult, ContextPack, ToolCall } from '../types'
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
import { synthesizeRawResponse } from './synthesis'
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

  const synthesis = await synthesizeRawResponse({
    llm: deps.llm,
    userMessage: input.message,
    proposals: round2WithQueue,
    gatingQuestions: finalInterviewQuestions,
    criticalQuestions: finalInterviewQuestions,
    contextPack: input.contextPack,
    activeSpecialist,
  })
  const naturalResponse = ensureCriticalQuestionsInText(synthesis.rawText, finalInterviewQuestions)

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
