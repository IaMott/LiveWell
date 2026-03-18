import { AgentProfile, AgentInput, ConsensusResult } from '../types'
import { deriveActiveSpecialistFromCaseState } from '../case/compat'
import { advanceCaseState, detectRequestedAgentId, getCaseRoutingDomain } from '../case/protocol'
import { detectDomainFromText, detectDomainsMulti } from '../domain/domainDetection'
import { LlmClient } from './agentExecution'
import { executeAgentRounds } from './agentRoundExecution'
import { executeConsensusFlow } from './consensusFlow'
import { adaptConsensusOutcome } from './consensusOutcome'
import {
  buildDomainDetectedTraceEvent,
  buildSpecialistModeResolvedTraceEvent,
} from './decisionTrace'
import { tryAgeQuestionFastPath, isGenericMessage } from './fastPaths'
import { applyInterviewFlow } from './interviewFlow'
import { resolveRoutingCandidates } from './routing'
import { synthesizeRawResponse } from './synthesis'
import { hardenFinalAnswer } from './finalAnswer'
import { planToolCalls } from './toolCallPlan'
import { getServerEnv } from '@/lib/validators/env'

/** Hard deadline for the entire orchestration pipeline (agents + synthesis). */
export const ORCHESTRATION_BUDGET_MS = 30_000

/** Rejects with a timeout error after `ms` milliseconds. */
function withGlobalTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`[orchestrator] ${label} exceeded global budget of ${ms}ms`)),
      ms,
    ),
  )
  return Promise.race([promise, deadline])
}

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
  retryGuardWindowMs?: number
  /** Override global orchestration budget in ms (default: ORCHESTRATION_BUDGET_MS). */
  globalTimeoutMs?: number
}

function getRetryGuardWindowMs(): number {
  const env = getServerEnv()
  return env.ORCH_RETRY_GUARD_WINDOW_MS ?? 2 * 60 * 1000
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const fastPath = tryAgeQuestionFastPath(input)
  if (fastPath.handled) return fastPath.result

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

  const caseProtocol = advanceCaseState({
    current: input.caseState ?? null,
    conversationId: input.conversationId,
    message: input.message,
    detectedDomain,
    allDomains,
    team: deps.team,
  })
  const activeSpecialist = deriveActiveSpecialistFromCaseState(caseProtocol.caseState, deps.team)
  const domainHint = getCaseRoutingDomain(caseProtocol.caseState, deps.team, detectedDomain)
  const requestedSpecialistId = detectRequestedAgentId(input.message, deps.team)
  decisionTrace.push(
    buildSpecialistModeResolvedTraceEvent({
      step: 2,
      requestedSpecialistId,
      previousActiveSpecialistId: input.caseState?.activeSpeakerAgentId ?? null,
      activeSpecialist,
      exitSpecialistMode:
        input.caseState?.protocolState === 'consult_active_takeover' &&
        caseProtocol.caseState.protocolState === 'owner_active',
      reason:
        caseProtocol.events[0]?.kind === 'return_baton'
          ? 'return_baton'
          : caseProtocol.caseState.protocolState,
    }),
  )

  const { selectedAgents, decisionTrace: routingDecisionTrace } = resolveRoutingCandidates({
    team: deps.team,
    message: input.message,
    detectedDomain: domainHint,
    allDomains,
    currentSpeakerId: activeSpecialist?.id,
  })
  decisionTrace.push(...routingDecisionTrace)

  // Skip agent rounds for generic messages (greetings, short no-context messages)
  // to prevent any specialist from contaminating the synthesis response.
  const skipAgents = !activeSpecialist && isGenericMessage(input)
  const globalTimeoutMs = deps.globalTimeoutMs ?? ORCHESTRATION_BUDGET_MS

  const { round1Proposals, round2Proposals } = skipAgents
    ? { round1Proposals: [], round2Proposals: [] }
    : await withGlobalTimeout(
        executeAgentRounds({
          llm: deps.llm,
          selectedAgents,
          input,
          domainHint,
        }),
        globalTimeoutMs,
        'executeAgentRounds',
      )

  const { consensus } = executeConsensusFlow({
    team: deps.team,
    round2Proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })
  const consensusOutcome = adaptConsensusOutcome({ consensus })

  const { finalInterviewQuestions, round2WithQueue, round2ForPersistence } = applyInterviewFlow({
    domain: domainHint,
    contextPack: input.contextPack,
    userMessage: input.message,
    consensusGatingQuestions: consensusOutcome.gatingQuestions,
    round2Proposals,
    activeSpecialist,
    teamAgentIds: deps.team.map((a) => a.id),
  })

  const synthesis = await synthesizeRawResponse({
    llm: deps.llm,
    userMessage: input.message,
    proposals: round2WithQueue,
    gatingQuestions: finalInterviewQuestions,
    // S3: criticalQuestions come from consensus (baseline safety/triage), not from the
    // interview-flow queue — passing the same array twice caused double-counting.
    criticalQuestions: consensusOutcome.gatingQuestions ?? [],
    contextPack: input.contextPack,
    activeSpecialist,
  })
  const finalAnswer = hardenFinalAnswer({
    rawText: synthesis.rawText,
    criticalQuestions: finalInterviewQuestions,
    userMessage: input.message,
  })

  const retryGuardWindowMs =
    typeof deps.retryGuardWindowMs === 'number' && deps.retryGuardWindowMs > 0
      ? deps.retryGuardWindowMs
      : getRetryGuardWindowMs()
  const toolCallPlan = planToolCalls({
    consensusToolCalls: consensusOutcome.toolCallsToExecute,
    message: input.message,
    domainHint,
    activeSpecialist,
    contextPack: input.contextPack,
    retryGuardWindowMs,
  })

  return {
    ...consensusOutcome.baseConsensus,
    caseState: caseProtocol.caseState,
    protocolEvents: caseProtocol.events,
    gatingQuestions: finalInterviewQuestions,
    toolCallsToExecute: toolCallPlan.toolCallsToExecute,
    finalMessageMarkdown: finalAnswer.finalText,
    activeSpecialist,
    debug: {
      selectedAgents:
        consensusOutcome.selectedAgentsFromConsensus.length > 0
          ? consensusOutcome.selectedAgentsFromConsensus
          : selectedAgents.map((a) => a.id),
      conflicts: [...consensusOutcome.conflicts, ...toolCallPlan.conflictMessages],
      decisionTrace,
      blockedToolCalls: toolCallPlan.blockedToolCalls,
      proposals: round2ForPersistence,
      round1Proposals,
      round2Proposals: round2ForPersistence,
    },
  }
}
