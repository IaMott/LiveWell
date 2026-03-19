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
  'voglio parlare ancora con',
  'voglio parlare al',
  'voglio il',
  'voglio la',
  'passami il',
  'passami la',
  'fammi parlare con',
  'vorrei parlare con',
  'continuiamo con',
  'restiamo con',
  'approfondiamo con',
  'seguimi tu',
  'mi segua lui',
  'mi segua lei',
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

const TAKEOVER_CONTINUITY_PATTERNS = [
  /\bcontinuiamo\s+con\b/i,
  /\bcontinua(?:re)?\s+con\b/i,
  /\bproseguiamo\s+con\b/i,
  /\bprosegui(?:amo)?\s+con\b/i,
  /\brestiamo\s+su\s+questo\s+tema\b/i,
  /\brestiamo\s+su\s+questa\s+parte\b/i,
  /\brestiamo\s+su\s+questo\s+percorso\b/i,
  /\bapprofondiamo\s+questa\s+parte\b/i,
  /\bapprofondiamo\b/i,
  /\bcontinuiamo\s+su\s+questo\b/i,
  /\bandiamo\s+avanti\s+su\s+questa\s+parte\b/i,
  /\bparliamo\s+ancora\s+di\s+questo\s+con\b/i,
  /\bvorrei\s+proseguire\s+con\b/i,
  /\bvorrei\s+che\s+fosse\s+lui\s+a\s+seguirmi\b/i,
  /\bvorrei\s+che\s+fosse\s+lei\s+a\s+seguirmi\b/i,
  /\bcontinuiamo\s+con\s+lui\b/i,
  /\bcontinuiamo\s+con\s+lei\b/i,
  /\bproseguiamo\s+con\s+lui\b/i,
  /\bproseguiamo\s+con\s+lei\b/i,
]

const HANDOFF_CONTINUITY_PATTERNS = [
  /\bcontinuiamo\s+su\b/i,
  /\bproseguiamo\s+su\b/i,
  /\bvorrei\s+che\s+mi\s+seguisse\b/i,
  /\bvorrei\s+proseguire\s+con\b/i,
  /\bmi\s+segua\s+lui\b/i,
  /\bmi\s+segua\s+lei\b/i,
  /\brestiamo\s+su\s+questo\s+percorso\b/i,
  /\bandiamo\s+avanti\s+su\s+questa\s+parte\b/i,
  /\bcontinuiamo\s+con\s+il\s+recupero\b/i,
  /\bcontinuiamo\s+con\s+la\s+terapia\b/i,
  /\bcontinuiamo\s+su\s+questo\s+tema\b/i,
  /\bparliamo\s+ancora\s+di\s+questo\s+con\b/i,
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

function isNaturalTakeoverContinuation(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return TAKEOVER_CONTINUITY_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function isMeaningfulHandoffContinuation(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (/^(ok|okay|va bene|perfetto|grazie|thanks|thank you)[!.,\s]*$/i.test(trimmed)) return false
  return trimmed.split(/\s+/).length > 3 || HANDOFF_CONTINUITY_PATTERNS.some((p) => p.test(trimmed))
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

function shouldKeepConsultTargetActive(params: {
  message: string
  consultTargetId?: string
  requestedAgentId: string | null
  currentOwnerAgentId: string
  detectedDomain: Domain
  team: AgentProfile[]
  takeoverTurns: number
}): boolean {
  const { consultTargetId, requestedAgentId, team, message, detectedDomain, takeoverTurns } = params
  if (!consultTargetId || takeoverTurns >= MAX_TAKEOVER_TURNS) return false
  if (requestedAgentId === consultTargetId) return true
  if (requestedAgentId && requestedAgentId !== consultTargetId) return false

  const consultTarget = team.find((agent) => agent.id === consultTargetId)
  if (!consultTarget) return false
  const lower = message.toLowerCase()
  const mentionsConsultTarget =
    lower.includes(normalizeAgentName(consultTarget.id)) ||
    lower.includes(normalizeAgentName(consultTarget.displayName))

  return (
    mentionsConsultTarget ||
    (isNaturalTakeoverContinuation(message) &&
      agentSupportsDetectedDomain(consultTarget, detectedDomain))
  )
}

function agentSupportsDetectedDomain(
  agent: AgentProfile | undefined,
  detectedDomain: Domain,
): boolean {
  if (!agent) return false
  if (detectedDomain === 'general') return true
  return agent.domainTags.includes(detectedDomain)
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
    const naturalHandoffContinuation = HANDOFF_CONTINUITY_PATTERNS.some((pattern) =>
      pattern.test(message),
    )
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
    const implicitHandoffReason =
      handoffReason ??
      (consultTarget != null &&
      naturalHandoffContinuation &&
      consultTarget !== current.ownerAgentId &&
      agentSupportsDetectedDomain(
        team.find((agent) => agent.id === consultTarget),
        detectedDomain,
      )
        ? `capability_handoff:${detectedDomain}`
        : null)
    const shouldRequestHandoff =
      consultTarget != null &&
      current.handoffCount < MAX_HANDOFFS &&
      !shouldReturnToOwner(message, current.ownerAgentId) &&
      requestedAgentId !== current.ownerAgentId &&
      isMeaningfulHandoffContinuation(message) &&
      Boolean(implicitHandoffReason) &&
      (Boolean(handoffReason) ||
        naturalHandoffContinuation ||
        shouldTriggerPermanentHandoff({
          team,
          ownerAgentId: current.ownerAgentId,
          consultTargetAgentId: consultTarget,
          detectedDomain,
          message,
        }))
    const continueTakeover = shouldKeepConsultTargetActive({
      message,
      consultTargetId: consultTarget,
      requestedAgentId,
      currentOwnerAgentId: current.ownerAgentId,
      detectedDomain,
      team,
      takeoverTurns: current.takeoverTurns,
    })

    if (shouldRequestHandoff && consultTarget) {
      const targetId = consultTarget
      const next: CaseState = {
        ...current,
        protocolState: 'handoff_pending_user',
        activeSpeakerAgentId: targetId,
        pendingHandoffAgentId: targetId,
        checkpointReason: implicitHandoffReason ?? 'domain_shift_confirmed_by_runtime',
      }
      events.push({
        kind: 'handoff_requested',
        actorAgentId: current.ownerAgentId,
        toAgentId: targetId,
        reason: implicitHandoffReason ?? 'domain_shift_confirmed_by_runtime',
      })
      return { caseState: next, events }
    }

    if (continueTakeover) {
      const targetId = consultTarget!
      const next: CaseState = {
        ...current,
        activeSpeakerAgentId: targetId,
        takeoverTurns: current.takeoverTurns + 1,
      }
      events.push({
        kind: 'takeover_continued',
        actorAgentId: targetId,
        reason: current.consultReason,
      })
      return { caseState: next, events }
    }

    if (
      shouldReturnToOwner(message, current.ownerAgentId) ||
      (!continueTakeover && !shouldRequestHandoff && requestedAgentId == null) ||
      requestedAgentId === current.ownerAgentId ||
      (requestedAgentId != null && requestedAgentId !== consultTarget) ||
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
