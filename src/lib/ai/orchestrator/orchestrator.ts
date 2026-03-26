import { AgentProfile, AgentInput, ConsensusResult } from '../types'
import {
  applyCanonicalSnapshotToLegacyCaseState,
  deriveActiveSpecialistFromCaseState,
  toCanonicalCaseStateSnapshot,
} from '../case/compat'
import { advanceCaseState, detectRequestedAgentId, getCaseRoutingDomain } from '../case/protocol'
import {
  detectDomainFromText,
  detectDomainsMulti,
  detectSignificantDomains,
} from '../domain/domainDetection'
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
import { buildMultiDomainTriage } from './multiDomainTriage'
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

export type ProgressEvent = {
  agentId: string
  displayName: string
  phase: 'analyzing' | 'peer-review' | 'consensus' | 'synthesizing'
  thought: string
}

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
  retryGuardWindowMs?: number
  /** Override global orchestration budget in ms (default: ORCHESTRATION_BUDGET_MS). */
  globalTimeoutMs?: number
  /** Optional callback for real-time progress events during orchestration. */
  onProgress?: (event: ProgressEvent) => void
  /** Per-agent average feedback scores (only populated if ≥3 ratings exist). Used for routing only. */
  agentFeedbackScores?: Record<string, number>
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
  const significantDomains = detectSignificantDomains(input.message).map((d) => d.domain)

  // Launch LLM extraction IN PARALLEL with the rest of orchestration.
  // This lightweight Gemini Flash call (~1s) extracts structured data from any Italian text
  // without depending on regex patterns. Result is awaited only before planToolCalls().
  const { llmExtractAttributes } = await import('./llmExtraction')
  const llmExtractionPromise = llmExtractAttributes(deps.llm, input.message, detectedDomain).catch(
    () => [] as import('../types').ToolCall[],
  )
  const decisionTrace = [
    buildDomainDetectedTraceEvent({
      step: 1,
      detectedDomain,
      allDomains,
      source: input.domainHint ? 'input.domainHint' : 'domainDetection',
    }),
  ]

  const currentCaseState =
    input.caseStateSnapshot != null
      ? applyCanonicalSnapshotToLegacyCaseState({
          snapshot: input.caseStateSnapshot,
          current: input.caseState ?? null,
        })
      : (input.caseState ?? null)

  const caseProtocol = advanceCaseState({
    current: currentCaseState,
    conversationId: input.conversationId,
    message: input.message,
    detectedDomain,
    allDomains,
    team: deps.team,
  })
  const nextStateSnapshot = toCanonicalCaseStateSnapshot(caseProtocol.caseState) ?? undefined
  const activeSpecialist = deriveActiveSpecialistFromCaseState(caseProtocol.caseState, deps.team)
  const domainHint = getCaseRoutingDomain(caseProtocol.caseState, deps.team, detectedDomain)
  const requestedSpecialistId = detectRequestedAgentId(input.message, deps.team)
  decisionTrace.push(
    buildSpecialistModeResolvedTraceEvent({
      step: 2,
      requestedSpecialistId,
      previousActiveSpecialistId: currentCaseState?.activeSpeakerAgentId ?? null,
      activeSpecialist,
      exitSpecialistMode:
        currentCaseState?.protocolState === 'consult_active_takeover' &&
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
    contextPack: input.contextPack,
  })
  decisionTrace.push(...routingDecisionTrace)

  // FIX-1: Emit meaningful phase title, not an echo of the user's text
  for (const agent of selectedAgents) {
    deps.onProgress?.({
      agentId: agent.id,
      displayName: agent.displayName,
      phase: 'analyzing',
      thought: 'Valutazione del caso in corso',
    })
  }

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

  // FIX-1: Show the FULL proposal reasoning, not truncated to 100 chars
  // P3: Only emit thinking events for agents with meaningful confidence (> 0.3)
  //     to avoid showing irrelevant specialists in the streaming UI.
  for (const proposal of round1Proposals) {
    const agent = deps.team.find((a) => a.id === proposal.agentId)
    const isRelevant = (proposal.confidence ?? 0) > 0.3
    if (
      agent &&
      isRelevant &&
      proposal.summary &&
      !proposal.summary.toLowerCase().includes('[unavailable]')
    ) {
      const thought =
        proposal.reasoning && proposal.reasoning.length > 5
          ? proposal.reasoning.replace(/\n/g, ' ')
          : proposal.summary.replace(/\n/g, ' ')
      deps.onProgress?.({
        agentId: agent.id,
        displayName: agent.displayName,
        phase: 'analyzing',
        thought,
      })
    }
  }

  // Emit peer-review progress when multiple agents contributed
  if (round2Proposals.length > 1) {
    const primary = deps.team.find((a) => a.id === round2Proposals[0]?.agentId)
    if (primary) {
      deps.onProgress?.({
        agentId: primary.id,
        displayName: primary.displayName,
        phase: 'peer-review',
        thought: 'Confronto tra specialisti',
      })
    }
  }

  const { consensus } = executeConsensusFlow({
    team: deps.team,
    round2Proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })
  const consensusOutcome = adaptConsensusOutcome({ consensus })

  // Emit consensus progress
  const winnerAgentId = consensusOutcome.selectedAgentsFromConsensus[0] ?? selectedAgents[0]?.id
  const winnerAgent = deps.team.find((a) => a.id === winnerAgentId)
  if (winnerAgent) {
    deps.onProgress?.({
      agentId: winnerAgent.id,
      displayName: winnerAgent.displayName,
      phase: 'consensus',
      thought: `Consenso raggiunto — ${winnerAgent.displayName} guida la risposta`,
    })
  }

  // FIX-3: When no activeSpecialist but domain is specific and proposals exist,
  // derive an implicit specialist from the top proposal. This prevents the
  // orchestrator from giving domain-specific advice in "team" voice.
  //
  // MULTI-DOMAIN GUARD: When the message spans 2+ distinct domains (e.g.
  // "ho male al ginocchio, nausea, non dormo, sono giù di morale"),
  // we stay in TEAM mode so ALL relevant specialists contribute to the
  // synthesis — no single specialist is forced as the voice.
  const isMultiDomain = significantDomains.filter((d) => d !== 'general').length >= 2
  let effectiveSpecialist = activeSpecialist
  if (
    !activeSpecialist &&
    domainHint !== 'general' &&
    round2Proposals.length > 0 &&
    !isMultiDomain
  ) {
    const topProposal = round2Proposals.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]
    if (topProposal && (topProposal.confidence ?? 0) >= 0.3) {
      const topAgent = deps.team.find((a) => a.id === topProposal.agentId)
      if (topAgent) {
        effectiveSpecialist = {
          id: topAgent.id,
          displayName: topAgent.displayName,
          domain: topProposal.domain,
          domains: topAgent.domainTags as import('../types').Domain[],
          runtimeCapabilities: topAgent.runtimeCapabilities,
        }
      }
    }
  }

  // ── Multi-domain triage ──────────────────────────────────────────────
  // When the message spans 2+ distinct domains and no specialist is locked in,
  // generate a triage response with quick-reply buttons instead of a blended
  // synthesis. This lets the user pick which topic to explore first.
  if (isMultiDomain && !effectiveSpecialist) {
    const triage = buildMultiDomainTriage(round2Proposals, deps.team)

    // Emit triage thinking event
    deps.onProgress?.({
      agentId: 'orchestratore',
      displayName: 'Team',
      phase: 'synthesizing',
      thought: 'Messaggio multi-dominio rilevato — preparo la selezione degli specialisti',
    })

    const llmExtractedToolCalls = await llmExtractionPromise
    const toolCallPlan = planToolCalls({
      consensusToolCalls: consensusOutcome.toolCallsToExecute,
      llmExtractedToolCalls,
      message: input.message,
      domainHint,
      activeSpecialist: undefined,
      contextPack: input.contextPack,
      retryGuardWindowMs:
        typeof deps.retryGuardWindowMs === 'number' && deps.retryGuardWindowMs > 0
          ? deps.retryGuardWindowMs
          : getRetryGuardWindowMs(),
    })

    return {
      ...consensusOutcome.baseConsensus,
      caseState: caseProtocol.caseState,
      stateSnapshot: nextStateSnapshot,
      protocolEvents: caseProtocol.events,
      finalMessageMarkdown: triage.message,
      quickReplies: triage.quickReplies,
      toolCallsToExecute: toolCallPlan.toolCallsToExecute,
      activeSpecialist: undefined,
      debug: {
        selectedAgents:
          consensusOutcome.selectedAgentsFromConsensus.length > 0
            ? consensusOutcome.selectedAgentsFromConsensus
            : selectedAgents.map((a) => a.id),
        conflicts: [...consensusOutcome.conflicts, ...toolCallPlan.conflictMessages],
        decisionTrace,
        blockedToolCalls: toolCallPlan.blockedToolCalls,
        proposals: round2Proposals,
        round1Proposals,
        round2Proposals,
      },
    }
  }

  const { finalInterviewQuestions, round2WithQueue, round2ForPersistence } = applyInterviewFlow({
    domain: domainHint,
    contextPack: input.contextPack,
    userMessage: input.message,
    consensusGatingQuestions: consensusOutcome.gatingQuestions,
    round2Proposals,
    activeSpecialist: effectiveSpecialist,
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
    activeSpecialist: effectiveSpecialist,
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

  // Await the LLM extraction that was launched in parallel at the start
  const llmExtractedToolCalls = await llmExtractionPromise

  const toolCallPlan = planToolCalls({
    consensusToolCalls: consensusOutcome.toolCallsToExecute,
    llmExtractedToolCalls,
    message: input.message,
    domainHint,
    activeSpecialist: effectiveSpecialist,
    contextPack: input.contextPack,
    retryGuardWindowMs,
  })

  return {
    ...consensusOutcome.baseConsensus,
    caseState: caseProtocol.caseState,
    stateSnapshot: nextStateSnapshot,
    protocolEvents: caseProtocol.events,
    gatingQuestions: finalInterviewQuestions,
    toolCallsToExecute: toolCallPlan.toolCallsToExecute,
    finalMessageMarkdown: finalAnswer.finalText,
    activeSpecialist: effectiveSpecialist,
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
