import {
  ActiveSpecialist,
  AgentProfile,
  AgentInput,
  CanonicalCaseStateSnapshot,
  ConsensusResult,
  Domain,
  DomainPanel,
} from '../types'
import {
  applyCanonicalSnapshotToLegacyCaseState,
  deriveActiveSpecialistFromCaseState,
  toCanonicalCaseStateSnapshot,
} from '../case/compat'
import type { CaseState } from '../case/state'
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
import { inferRoutingWithLlm, resolveContextualRouting } from './contextualRouting'
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
}

function getRetryGuardWindowMs(): number {
  const env = getServerEnv()
  return env.ORCH_RETRY_GUARD_WINDOW_MS ?? 2 * 60 * 1000
}

function uniqueDomains(values: Array<Domain | null | undefined>, includeGeneral = false): Domain[] {
  const out: Domain[] = []
  for (const value of values) {
    if (!value) continue
    if (!includeGeneral && value === 'general') continue
    if (!out.includes(value)) out.push(value)
  }
  return out
}

function agentSupportsDomain(
  team: AgentProfile[],
  agentId: string | null | undefined,
  domain: Domain,
) {
  if (!agentId) return false
  const agent = team.find((candidate) => candidate.id === agentId)
  if (!agent) return false
  return domain === 'general' ? true : agent.domainTags.includes(domain)
}

function buildCanonicalRoutingSnapshot(params: {
  input: AgentInput
  caseState: CaseState
  team: AgentProfile[]
  detectedDomain: Domain
  allDomains: Domain[]
  selectedAgents: AgentProfile[]
  activeSpecialist?: ActiveSpecialist
}): CanonicalCaseStateSnapshot | undefined {
  const { input, caseState, team, detectedDomain, allDomains, selectedAgents, activeSpecialist } =
    params
  const baseSnapshot = toCanonicalCaseStateSnapshot(caseState)
  if (!baseSnapshot) return undefined

  const previousSnapshot = input.caseStateSnapshot ?? baseSnapshot
  const specialistSpecificDomains = uniqueDomains([
    activeSpecialist?.domain,
    ...(activeSpecialist?.domains ?? []),
  ])
  const previousSpecificDomains = uniqueDomains([
    previousSnapshot.leadDomain,
    ...(previousSnapshot.activeDomains ?? []),
    ...previousSnapshot.domainPanels.map((panel) => panel.domain),
  ])
  const routingSpecificDomains = uniqueDomains([detectedDomain, ...allDomains])
  const effectiveLeadDomain =
    detectedDomain !== 'general'
      ? detectedDomain
      : previousSnapshot.leadDomain && previousSnapshot.leadDomain !== 'general'
        ? previousSnapshot.leadDomain
        : specialistSpecificDomains[0]
  const activeDomains = uniqueDomains([
    effectiveLeadDomain ?? undefined,
    ...routingSpecificDomains,
    ...previousSpecificDomains,
  ])

  if (activeDomains.length === 0) return baseSnapshot

  const leadDomain = effectiveLeadDomain ?? activeDomains[0] ?? null
  if (!leadDomain) return baseSnapshot

  const nowIso = new Date().toISOString()
  const orderedDomains = uniqueDomains([leadDomain, ...activeDomains])

  const domainPanels: DomainPanel[] = orderedDomains.map((domain, index) => {
    const previousPanel = previousSnapshot.domainPanels.find((panel) => panel.domain === domain)
    const candidateAgentIds: string[] = []
    const pushCandidate = (agentId?: string | null) => {
      if (!agentId || candidateAgentIds.includes(agentId)) return
      if (!agentSupportsDomain(team, agentId, domain)) return
      candidateAgentIds.push(agentId)
    }

    if (domain === leadDomain) {
      pushCandidate(caseState.activeSpeakerAgentId)
      pushCandidate(activeSpecialist?.id)
    }

    pushCandidate(previousPanel?.selectedAgentId)
    for (const agentId of previousPanel?.candidateAgentIds ?? []) pushCandidate(agentId)

    for (const agent of selectedAgents) {
      if (domain === 'general' || agent.domainTags.includes(domain)) pushCandidate(agent.id)
    }

    pushCandidate(caseState.ownerAgentId)

    for (const agent of team) {
      if (domain === 'general' || agent.domainTags.includes(domain)) pushCandidate(agent.id)
    }

    const selectedAgentId =
      domain !== leadDomain &&
      previousPanel?.selectedAgentId &&
      candidateAgentIds.includes(previousPanel.selectedAgentId)
        ? previousPanel.selectedAgentId
        : (candidateAgentIds[0] ?? previousPanel?.selectedAgentId ?? null)

    return {
      domain,
      selectedAgentId,
      candidateAgentIds,
      status: domain === leadDomain ? 'active' : (previousPanel?.status ?? 'monitoring'),
      priorityScore:
        previousPanel?.priorityScore ?? (index === 0 ? 1 : Math.max(0.35, 0.85 - index * 0.2)),
      lastReasoningAt: nowIso,
      pendingNeeds: previousPanel?.pendingNeeds ?? [],
    }
  })

  return {
    ...baseSnapshot,
    activeDomains,
    domainPanels,
    leadDomain,
    speakerPolicy:
      caseState.activeSpeakerAgentId !== caseState.ownerAgentId
        ? 'explicit_agent'
        : baseSnapshot.speakerPolicy,
    updatedAt: nowIso,
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const fastPath = tryAgeQuestionFastPath(input)
  if (fastPath.handled) return fastPath.result

  const heuristicDetectedDomain = input.domainHint ?? detectDomainFromText(input.message)
  const heuristicAllDomains = detectDomainsMulti(input.message).map((d) => d.domain)

  // Launch LLM extraction IN PARALLEL with the rest of orchestration.
  // This lightweight Gemini Flash call (~1s) extracts structured data from any Italian text
  // without depending on regex patterns. Result is awaited only before planToolCalls().
  const { llmExtractAttributes } = await import('./llmExtraction')
  const llmExtractionPromise = llmExtractAttributes(
    deps.llm,
    input.message,
    heuristicDetectedDomain,
  ).catch(() => [] as import('../types').ToolCall[])
  const llmRoutingPromise = inferRoutingWithLlm({
    llm: deps.llm,
    team: deps.team,
    input,
    heuristicDetectedDomain,
    heuristicAllDomains,
  }).catch(() => null)
  const [llmExtractedAttributes, llmRouting] = await Promise.all([
    llmExtractionPromise,
    llmRoutingPromise,
  ])
  const routingResolution = resolveContextualRouting({
    input,
    heuristicDetectedDomain,
    heuristicAllDomains,
    llmExtractionCalls: llmExtractedAttributes,
    llmRouting,
  })
  const detectedDomain = routingResolution.detectedDomain
  const allDomains = routingResolution.allDomains
  const significantDomains = detectSignificantDomains(input.message).map((d) => d.domain)
  const decisionTrace = [
    buildDomainDetectedTraceEvent({
      step: 1,
      detectedDomain,
      allDomains,
      source: routingResolution.source,
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
    preferredAgentIds: routingResolution.preferredAgentIds,
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

  // When the message is genuinely multi-domain (e.g. user mentions both emotional
  // state AND nutrition), we MUST synthesize in TEAM mode so every specialist's
  // contribution is visible — even if a single specialist was previously active.
  // The active specialist leads the routing (appears first in selectedAgents) but
  // must NOT monopolise the synthesis voice.
  let effectiveSpecialist =
    isMultiDomain && selectedAgents.length >= 2 ? undefined : activeSpecialist
  if (
    !effectiveSpecialist &&
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

  const canonicalRoutingSnapshot = buildCanonicalRoutingSnapshot({
    input,
    caseState: caseProtocol.caseState,
    team: deps.team,
    detectedDomain: domainHint,
    allDomains,
    selectedAgents,
    activeSpecialist: effectiveSpecialist,
  })
  const enrichedCaseState = canonicalRoutingSnapshot
    ? applyCanonicalSnapshotToLegacyCaseState({
        snapshot: canonicalRoutingSnapshot,
        current: caseProtocol.caseState,
      })
    : caseProtocol.caseState

  // ── Multi-domain triage (legacy fallback only) ───────────────────────────
  // When routing already selected multiple domain agents (selectedAgents.length >= 2),
  // those agents have fully reasoned in Round 1 + Round 2 and produced real domain-specific
  // proposals. In that case we MUST synthesize their combined output — NOT interrupt the
  // pipeline with a "pick a domain" triage.
  //
  // Triage only fires for the edge case where routing produced a single agent but the
  // domain detector still sees 2+ significant domains — a mismatch that can happen with
  // very ambiguous one-liners ("sto male"). In that scenario we fall back to quick replies.
  if (isMultiDomain && !effectiveSpecialist && selectedAgents.length < 2) {
    const triage = buildMultiDomainTriage(round2Proposals, deps.team)

    // Emit triage thinking event
    deps.onProgress?.({
      agentId: 'orchestratore',
      displayName: 'Team',
      phase: 'synthesizing',
      thought: 'Messaggio molto generico rilevato — propongo i domini disponibili',
    })

    const toolCallPlan = planToolCalls({
      consensusToolCalls: consensusOutcome.toolCallsToExecute,
      llmExtractedToolCalls: llmExtractedAttributes,
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
      domain: canonicalRoutingSnapshot?.leadDomain ?? consensusOutcome.baseConsensus.domain,
      caseState: enrichedCaseState,
      stateSnapshot: canonicalRoutingSnapshot ?? nextStateSnapshot,
      protocolEvents: caseProtocol.events,
      finalMessageMarkdown: triage.message,
      quickReplies: triage.quickReplies,
      toolCallsToExecute: toolCallPlan.toolCallsToExecute,
      activeSpecialist: undefined,
      ui: {
        ...consensusOutcome.baseConsensus.ui,
        domainIcon:
          canonicalRoutingSnapshot?.leadDomain ?? consensusOutcome.baseConsensus.ui.domainIcon,
      },
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

  const toolCallPlan = planToolCalls({
    consensusToolCalls: consensusOutcome.toolCallsToExecute,
    llmExtractedToolCalls: llmExtractedAttributes,
    message: input.message,
    domainHint,
    activeSpecialist: effectiveSpecialist,
    contextPack: input.contextPack,
    retryGuardWindowMs,
  })

  return {
    ...consensusOutcome.baseConsensus,
    domain: canonicalRoutingSnapshot?.leadDomain ?? consensusOutcome.baseConsensus.domain,
    caseState: enrichedCaseState,
    stateSnapshot: canonicalRoutingSnapshot ?? nextStateSnapshot,
    protocolEvents: caseProtocol.events,
    gatingQuestions: finalInterviewQuestions,
    toolCallsToExecute: toolCallPlan.toolCallsToExecute,
    finalMessageMarkdown: finalAnswer.finalText,
    activeSpecialist: effectiveSpecialist,
    ui: {
      ...consensusOutcome.baseConsensus.ui,
      domainIcon:
        canonicalRoutingSnapshot?.leadDomain ?? consensusOutcome.baseConsensus.ui.domainIcon,
    },
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
