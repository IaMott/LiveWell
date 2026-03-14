import { AgentProfile, AgentInput, ConsensusResult } from '../types'
import { detectDomainFromText, detectDomainsMulti } from '../domain/domainDetection'
import { LlmClient } from './agentExecution'
import { executeAgentRounds } from './agentRoundExecution'
import { executeConsensusFlow } from './consensusFlow'
import { adaptConsensusOutcome } from './consensusOutcome'
import { buildDomainDetectedTraceEvent } from './decisionTrace'
import { tryAgeQuestionFastPath } from './fastPaths'
import { applyInterviewFlow } from './interviewFlow'
import { resolveRoutingContext } from './routing'
import { synthesizeRawResponse } from './synthesis'
import { hardenFinalAnswer } from './finalAnswer'
import { planToolCalls } from './toolCallPlan'
import { getServerEnv } from '@/lib/validators/env'

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
  retryGuardWindowMs?: number
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
  const finalAnswer = hardenFinalAnswer({
    rawText: synthesis.rawText,
    criticalQuestions: finalInterviewQuestions,
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
