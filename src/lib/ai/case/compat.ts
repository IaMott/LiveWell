import type {
  ActiveSpecialist,
  AgentProfile,
  CanonicalCaseStateSnapshot,
  ConversationFocus,
  CoordinationState,
  Domain,
  DomainPanel,
  SpeakerPolicy,
} from '../types'
import { resolveAgentRuntimeDomain } from '../team/domainMapping'
import { CaseState } from './state'

function toCanonicalDomain(value: string | null | undefined): Domain | null {
  if (
    value === 'general' ||
    value === 'nutrition' ||
    value === 'health' ||
    value === 'training' ||
    value === 'mindfulness' ||
    value === 'inspiration' ||
    value === 'coordination'
  ) {
    return value
  }
  return null
}

function normalizeDomainList(values: string[] | undefined, leadDomain: Domain | null): Domain[] {
  const unique = new Set<Domain>()
  for (const value of values ?? []) {
    const domain = toCanonicalDomain(value)
    if (domain) unique.add(domain)
  }
  if (leadDomain) unique.add(leadDomain)
  return [...unique]
}

function toCanonicalPanels(caseState: CaseState): DomainPanel[] {
  const explicitPanels =
    caseState.domainPanels
      ?.map((panel) => {
        const domain = toCanonicalDomain(panel.domain)
        if (!domain) return null
        return {
          domain,
          selectedAgentId: panel.selectedAgentId,
          candidateAgentIds: panel.candidateAgentIds,
          status: panel.status,
          priorityScore: panel.priorityScore,
          lastReasoningAt: panel.lastReasoningAt,
          pendingNeeds: panel.pendingNeeds,
        } satisfies DomainPanel
      })
      .filter((panel): panel is DomainPanel => panel != null) ?? []

  if (explicitPanels.length > 0) return explicitPanels

  return [
    {
      domain: 'general',
      selectedAgentId: caseState.activeSpeakerAgentId ?? caseState.ownerAgentId,
      candidateAgentIds: [
        caseState.activeSpeakerAgentId ?? caseState.ownerAgentId,
        caseState.ownerAgentId,
      ].filter(
        (value, index, arr): value is string =>
          typeof value === 'string' && arr.indexOf(value) === index,
      ),
      status: 'active',
      priorityScore: 0,
      lastReasoningAt: caseState.updatedAt ?? null,
      pendingNeeds: [],
    },
  ]
}

function toCanonicalFocus(caseState: CaseState): ConversationFocus {
  return {
    activeProblems: caseState.conversationFocus?.activeProblems ?? [],
    activeGoals: caseState.conversationFocus?.activeGoals ?? [],
    activeConstraints: caseState.conversationFocus?.activeConstraints ?? [],
    summary: caseState.conversationFocus?.summary ?? null,
  }
}

function toCanonicalCoordination(caseState: CaseState): CoordinationState {
  return {
    crossDomainConflicts: caseState.coordinationState?.crossDomainConflicts ?? [],
    dependencies: caseState.coordinationState?.dependencies ?? [],
    needsReview: caseState.coordinationState?.needsReview ?? false,
  }
}

function toCanonicalSpeakerPolicy(caseState: CaseState): SpeakerPolicy {
  if (caseState.speakerPolicy) return caseState.speakerPolicy
  return caseState.activeSpeakerAgentId !== caseState.ownerAgentId ? 'explicit_agent' : 'lead'
}

function inferLegacyProtocolState(
  snapshot: CanonicalCaseStateSnapshot,
): CaseState['protocolState'] {
  if (snapshot.speakerPolicy === 'explicit_agent' || snapshot.speakerPolicy === 'switch') {
    return 'consult_active_takeover'
  }
  return 'owner_active'
}

export function toCanonicalCaseStateSnapshot(
  caseState: CaseState | null | undefined,
): CanonicalCaseStateSnapshot | null {
  if (!caseState) return null

  const leadDomain = toCanonicalDomain(caseState.leadDomain)
  const domainPanels = toCanonicalPanels(caseState)
  const activeDomains = normalizeDomainList(caseState.activeDomains, leadDomain)

  return {
    schemaVersion: Math.max(1, caseState.schemaVersion ?? 1),
    conversationId: caseState.conversationId,
    activeDomains,
    domainPanels,
    leadDomain: leadDomain ?? domainPanels[0]?.domain ?? null,
    speakerPolicy: toCanonicalSpeakerPolicy(caseState),
    conversationFocus: toCanonicalFocus(caseState),
    coordinationState: toCanonicalCoordination(caseState),
    sharedOpenQuestions: caseState.sharedOpenQuestions ?? [],
    domainOpenQuestions: caseState.domainOpenQuestions ?? {},
    updatedAt: caseState.updatedAt ?? new Date(0).toISOString(),
    // Preserve consultation context across snapshot conversions
    consultReason: caseState.consultReason ?? undefined,
    returnTargetAgentId: caseState.returnTargetAgentId ?? undefined,
    consultTargetAgentId: caseState.consultTargetAgentId ?? undefined,
  }
}

export function applyCanonicalSnapshotToLegacyCaseState(params: {
  snapshot: CanonicalCaseStateSnapshot
  current?: CaseState | null
}): CaseState {
  const { snapshot, current } = params
  const leadPanel =
    snapshot.domainPanels.find((panel) => panel.domain === snapshot.leadDomain) ??
    snapshot.domainPanels[0]
  const leadAgentId =
    leadPanel?.selectedAgentId ??
    current?.activeSpeakerAgentId ??
    current?.ownerAgentId ??
    'orchestratore'
  const ownerAgentId = current?.ownerAgentId ?? leadAgentId

  return {
    conversationId: snapshot.conversationId,
    ownerAgentId,
    activeSpeakerAgentId: leadAgentId,
    protocolState: current?.protocolState ?? inferLegacyProtocolState(snapshot),
    consultTargetAgentId: current?.consultTargetAgentId,
    returnTargetAgentId: current?.returnTargetAgentId,
    consultReason: current?.consultReason,
    pendingHandoffAgentId: current?.pendingHandoffAgentId,
    checkpointReason: current?.checkpointReason,
    takeoverTurns: current?.takeoverTurns ?? 0,
    loopCount: current?.loopCount ?? 0,
    handoffCount: current?.handoffCount ?? 0,
    schemaVersion: snapshot.schemaVersion,
    activeDomains: snapshot.activeDomains,
    domainPanels: snapshot.domainPanels.map((panel) => ({
      domain: panel.domain,
      selectedAgentId: panel.selectedAgentId,
      candidateAgentIds: panel.candidateAgentIds,
      status: panel.status,
      priorityScore: panel.priorityScore,
      lastReasoningAt: panel.lastReasoningAt,
      pendingNeeds: panel.pendingNeeds,
    })),
    leadDomain: snapshot.leadDomain,
    speakerPolicy: snapshot.speakerPolicy,
    conversationFocus: {
      activeProblems: snapshot.conversationFocus.activeProblems,
      activeGoals: snapshot.conversationFocus.activeGoals,
      activeConstraints: snapshot.conversationFocus.activeConstraints,
      summary: snapshot.conversationFocus.summary,
    },
    coordinationState: {
      crossDomainConflicts: snapshot.coordinationState.crossDomainConflicts,
      dependencies: snapshot.coordinationState.dependencies,
      needsReview: snapshot.coordinationState.needsReview,
    },
    sharedOpenQuestions: snapshot.sharedOpenQuestions,
    domainOpenQuestions: snapshot.domainOpenQuestions,
    updatedAt: snapshot.updatedAt,
  }
}

export function deriveActiveSpecialistFromCaseState(
  caseState: CaseState | null,
  team: AgentProfile[],
): ActiveSpecialist | undefined {
  if (!caseState) return undefined
  const snapshot = toCanonicalCaseStateSnapshot(caseState)
  const leadPanel =
    snapshot?.domainPanels.find((panel) => panel.domain === snapshot.leadDomain) ??
    snapshot?.domainPanels[0]
  const fallbackAgentId = leadPanel?.selectedAgentId ?? caseState.activeSpeakerAgentId
  const agent = team.find((candidate) => candidate.id === fallbackAgentId)
  if (!agent) return undefined

  const specialistLedOwnerState =
    caseState.protocolState === 'owner_active' &&
    agent.id !== 'orchestratore' &&
    !agent.domainTags.includes('coordination')

  if (
    caseState.protocolState !== 'consult_active_takeover' &&
    caseState.protocolState !== 'handoff_pending_user' &&
    caseState.consultReason !== 'explicit_initial_owner' &&
    caseState.consultReason !== 'permanent_handoff' &&
    !specialistLedOwnerState
  ) {
    return undefined
  }

  return {
    id: agent.id,
    displayName: agent.displayName,
    domain: resolveAgentRuntimeDomain(agent, {
      preferredDomain: leadPanel?.domain ?? snapshot?.leadDomain ?? null,
    }),
    domains: agent.domainTags,
    runtimeCapabilities: agent.runtimeCapabilities,
  }
}

export function getOwnerAgentProfile(
  caseState: CaseState | null,
  team: AgentProfile[],
): AgentProfile | undefined {
  if (!caseState) return undefined
  return team.find((candidate) => candidate.id === caseState.ownerAgentId)
}
