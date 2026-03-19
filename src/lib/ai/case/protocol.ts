import type { AgentProfile, Domain } from '../types'
import {
  findCapabilityConsultTarget,
  findPermanentHandoffTriggerReason,
  shouldTriggerPermanentHandoff,
} from '../capabilities/registry'
import { selectAgentsForRequest } from '../orchestrator/agentSelection'
import { CaseProtocolEvent, CaseState } from './state'

const MAX_CONSULT_LOOPS = 3
const MAX_TAKEOVER_TURNS = 2
const MAX_HANDOFFS = 2

const REQUEST_VERBS = [
  'parlami con',
  'parla con',
  'voglio parlare con',
  'voglio parlare al',
  'voglio il',
  'voglio la',
  'passami il',
  'passami la',
  'fammi parlare con',
  'vorrei parlare con',
  'speak to',
  'talk to',
]

const RETURN_PATTERNS = [
  /torna\s+al\s+team/i,
  /torna\s+all'?orchestratore/i,
  /torna\s+allo?\s+specialista\s+iniziale/i,
  /restituisci\s+il\s+testimone/i,
  /torna\s+a\s+chi\s+seguiva\s+il\s+caso/i,
]

type AdvanceCaseStateParams = {
  current: CaseState | null
  conversationId: string
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  team: AgentProfile[]
}

export type AdvanceCaseStateResult = {
  caseState: CaseState
  events: CaseProtocolEvent[]
}

function normalizeAgentName(value: string): string {
  return value.toLowerCase().replace(/[-_]/g, ' ').trim()
}

export function detectRequestedAgentId(message: string, team: AgentProfile[]): string | null {
  const lower = message.toLowerCase()
  const hasVerb = REQUEST_VERBS.some((verb) => lower.includes(verb))

  for (const agent of team) {
    const byId = normalizeAgentName(agent.id)
    const byName = normalizeAgentName(agent.displayName)
    if (lower.includes(byId) || lower.includes(byName)) {
      if (hasVerb || lower.includes('parlare con') || lower.includes('passami')) return agent.id
    }
  }

  return null
}

function shouldReturnToOwner(message: string, ownerAgentId: string): boolean {
  const lower = message.toLowerCase()
  return (
    RETURN_PATTERNS.some((pattern) => pattern.test(message)) ||
    lower.includes(normalizeAgentName(ownerAgentId))
  )
}

function isMeaningfulHandoffContinuation(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (/^(ok|okay|va bene|perfetto|grazie|thanks|thank you)[!.,\s]*$/i.test(trimmed)) return false
  return trimmed.split(/\s+/).length > 3
}

function chooseInitialOwner(params: {
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  team: AgentProfile[]
}): string {
  const requested = detectRequestedAgentId(params.message, params.team)
  if (requested) return requested

  if (params.detectedDomain === 'general') {
    const neutralOwner =
      params.team.find((agent) => agent.id === 'orchestratore') ??
      params.team.find(
        (agent) =>
          agent.domainTags.includes('coordination') || agent.domainTags.includes('general'),
      )
    return neutralOwner?.id ?? 'orchestratore'
  }

  const selected = selectAgentsForRequest(
    params.team.filter((agent) => agent.id !== 'orchestratore'),
    params.detectedDomain,
    1,
    params.allDomains,
    params.message,
  )

  if (selected[0]?.id) return selected[0].id

  const fallback =
    params.team.find((agent) => agent.domainTags.includes(params.detectedDomain)) ??
    params.team.find((agent) => agent.id !== 'orchestratore') ??
    params.team[0]

  return fallback?.id ?? 'orchestratore'
}

export function getCaseRoutingDomain(
  caseState: CaseState | null,
  team: AgentProfile[],
  fallbackDomain: Domain,
): Domain {
  if (!caseState) return fallbackDomain
  const current = team.find((agent) => agent.id === caseState.activeSpeakerAgentId)
  if (fallbackDomain === 'general' && current?.domainTags.includes('coordination')) return 'general'
  if (current?.domainTags.includes(fallbackDomain)) return fallbackDomain
  if (fallbackDomain !== 'general') return fallbackDomain
  const preferred = current?.domainTags.find(
    (domain) => domain !== 'general' && domain !== 'coordination',
  )
  return (preferred ?? current?.domainTags[0] ?? fallbackDomain) as Domain
}

export function advanceCaseState(params: AdvanceCaseStateParams): AdvanceCaseStateResult {
  const { current, conversationId, message, detectedDomain, allDomains, team } = params
  const events: CaseProtocolEvent[] = []

  if (!current) {
    const requestedAgentId = detectRequestedAgentId(message, team)
    const ownerAgentId =
      requestedAgentId ?? chooseInitialOwner({ message, detectedDomain, allDomains, team })
    const initial: CaseState = {
      conversationId,
      ownerAgentId,
      activeSpeakerAgentId: ownerAgentId,
      protocolState: 'owner_active',
      consultReason: requestedAgentId ? 'explicit_initial_owner' : undefined,
      takeoverTurns: 0,
      loopCount: 0,
      handoffCount: 0,
    }
    events.push({ kind: 'initialized', actorAgentId: ownerAgentId })
    return { caseState: initial, events }
  }

  const requestedAgentId = detectRequestedAgentId(message, team)
  const capabilityConsult =
    current.protocolState === 'owner_active' && !requestedAgentId
      ? findCapabilityConsultTarget({
          team,
          ownerAgentId: current.ownerAgentId,
          detectedDomain,
          message,
        })
      : null

  if (current.protocolState === 'handoff_pending_user') {
    const pendingHandoffAgentId = current.pendingHandoffAgentId ?? current.activeSpeakerAgentId

    if (shouldReturnToOwner(message, current.returnTargetAgentId ?? current.ownerAgentId)) {
      const next: CaseState = {
        conversationId,
        ownerAgentId: current.returnTargetAgentId ?? current.ownerAgentId,
        activeSpeakerAgentId: current.returnTargetAgentId ?? current.ownerAgentId,
        protocolState: 'owner_active',
        takeoverTurns: 0,
        loopCount: current.loopCount,
        handoffCount: current.handoffCount,
      }
      events.push({
        kind: 'return_baton',
        fromAgentId: pendingHandoffAgentId,
        toAgentId: next.ownerAgentId,
        reason: current.checkpointReason ?? 'handoff_cancelled',
      })
      return { caseState: next, events }
    }

    const next: CaseState = {
      conversationId,
      ownerAgentId: pendingHandoffAgentId,
      activeSpeakerAgentId: pendingHandoffAgentId,
      protocolState: 'owner_active',
      consultReason: 'permanent_handoff',
      takeoverTurns: 0,
      loopCount: current.loopCount,
      handoffCount: current.handoffCount + 1,
    }
    events.push({
      kind: 'handoff_completed',
      fromAgentId: current.ownerAgentId,
      toAgentId: pendingHandoffAgentId,
      reason: current.checkpointReason ?? 'domain_shift_confirmed',
    })
    return { caseState: next, events }
  }

  if (current.protocolState === 'consult_active_takeover') {
    const consultTarget = current.consultTargetAgentId
    const returnTarget = current.returnTargetAgentId ?? current.ownerAgentId
    const handoffReason =
      consultTarget != null
        ? findPermanentHandoffTriggerReason({
            team,
            ownerAgentId: current.ownerAgentId,
            consultTargetAgentId: consultTarget,
            detectedDomain,
            message,
          })
        : null
    const shouldRequestHandoff =
      consultTarget != null &&
      current.handoffCount < MAX_HANDOFFS &&
      !shouldReturnToOwner(message, current.ownerAgentId) &&
      requestedAgentId !== current.ownerAgentId &&
      isMeaningfulHandoffContinuation(message) &&
      Boolean(handoffReason) &&
      shouldTriggerPermanentHandoff({
        team,
        ownerAgentId: current.ownerAgentId,
        consultTargetAgentId: consultTarget,
        detectedDomain,
        message,
      })
    const continueTakeover =
      consultTarget != null &&
      requestedAgentId === consultTarget &&
      current.takeoverTurns < MAX_TAKEOVER_TURNS

    if (shouldRequestHandoff && consultTarget) {
      const next: CaseState = {
        ...current,
        protocolState: 'handoff_pending_user',
        activeSpeakerAgentId: consultTarget,
        pendingHandoffAgentId: consultTarget,
        checkpointReason: handoffReason ?? 'domain_shift_confirmed_by_runtime',
      }
      events.push({
        kind: 'handoff_requested',
        actorAgentId: current.ownerAgentId,
        toAgentId: consultTarget,
        reason: handoffReason ?? 'domain_shift_confirmed_by_runtime',
      })
      return { caseState: next, events }
    }

    if (continueTakeover) {
      const next: CaseState = {
        ...current,
        activeSpeakerAgentId: consultTarget,
        takeoverTurns: current.takeoverTurns + 1,
      }
      events.push({
        kind: 'takeover_continued',
        actorAgentId: consultTarget,
        reason: current.consultReason,
      })
      return { caseState: next, events }
    }

    if (
      shouldReturnToOwner(message, current.ownerAgentId) ||
      requestedAgentId == null ||
      requestedAgentId === current.ownerAgentId ||
      requestedAgentId !== consultTarget ||
      current.takeoverTurns >= MAX_TAKEOVER_TURNS
    ) {
      const next: CaseState = {
        conversationId,
        ownerAgentId: current.ownerAgentId,
        activeSpeakerAgentId: returnTarget,
        protocolState: 'owner_active',
        takeoverTurns: 0,
        loopCount: current.loopCount,
        handoffCount: current.handoffCount,
      }
      events.push({
        kind: 'return_baton',
        fromAgentId: consultTarget,
        toAgentId: returnTarget,
        reason: current.consultReason,
      })
      return { caseState: next, events }
    }
  }

  if (
    current.protocolState === 'owner_active' &&
    ((requestedAgentId && requestedAgentId !== current.ownerAgentId) || capabilityConsult)
  ) {
    const nextSpeaker = capabilityConsult?.agentId ?? requestedAgentId
    if (!nextSpeaker || nextSpeaker === current.ownerAgentId) {
      return { caseState: current, events }
    }
    if (current.loopCount >= MAX_CONSULT_LOOPS) {
      events.push({
        kind: 'consult_blocked',
        actorAgentId: current.ownerAgentId,
        toAgentId: nextSpeaker,
        reason: 'consult_loop_guard',
      })
      return { caseState: current, events }
    }

    const next: CaseState = {
      conversationId,
      ownerAgentId: current.ownerAgentId,
      activeSpeakerAgentId: nextSpeaker,
      protocolState: 'consult_active_takeover',
      consultTargetAgentId: nextSpeaker,
      returnTargetAgentId: current.ownerAgentId,
      consultReason: capabilityConsult?.reason ?? 'user_requested_specialist',
      takeoverTurns: 1,
      loopCount: current.loopCount + 1,
      handoffCount: current.handoffCount,
    }
    events.push({
      kind: 'consult_requested',
      actorAgentId: current.ownerAgentId,
      toAgentId: nextSpeaker,
      reason: capabilityConsult?.reason ?? 'user_requested_specialist',
    })
    events.push({
      kind: 'takeover_started',
      fromAgentId: current.ownerAgentId,
      toAgentId: nextSpeaker,
      reason: capabilityConsult?.reason ?? 'user_requested_specialist',
    })
    return { caseState: next, events }
  }

  return { caseState: current, events }
}
