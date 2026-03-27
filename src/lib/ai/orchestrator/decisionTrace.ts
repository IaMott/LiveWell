import { ActiveSpecialist, DecisionTraceEvent, Domain } from '../types'

type DecisionTraceData = Record<string, string | number | boolean | null | string[]>

export function createDecisionTraceEvent(
  step: number,
  kind: DecisionTraceEvent['kind'],
  summary: string,
  data: DecisionTraceData,
): DecisionTraceEvent {
  return { step, kind, summary, data }
}

export function buildDomainDetectedTraceEvent(params: {
  step: number
  detectedDomain: Domain
  allDomains: Domain[]
  source:
    | 'input.domainHint'
    | 'llm_context'
    | 'snapshot_context'
    | 'history_context'
    | 'domainDetection'
}): DecisionTraceEvent {
  const { step, detectedDomain, allDomains, source } = params
  return createDecisionTraceEvent(
    step,
    'domain_detected',
    `Dominio iniziale rilevato: ${detectedDomain}`,
    {
      detectedDomain,
      allDomains,
      source,
    },
  )
}

export function buildSpecialistModeResolvedTraceEvent(params: {
  step: number
  requestedSpecialistId: string | null
  previousActiveSpecialistId: string | null
  activeSpecialist: ActiveSpecialist | undefined
  exitSpecialistMode: boolean
  reason: string
}): DecisionTraceEvent {
  const {
    step,
    requestedSpecialistId,
    previousActiveSpecialistId,
    activeSpecialist,
    exitSpecialistMode,
    reason,
  } = params

  return createDecisionTraceEvent(
    step,
    'specialist_mode_resolved',
    activeSpecialist
      ? `Modalita specialista attiva: ${activeSpecialist.id}`
      : 'Modalita specialista non attiva',
    {
      requestedSpecialistId,
      previousActiveSpecialistId,
      activeSpecialistId: activeSpecialist?.id ?? null,
      exitSpecialistMode,
      reason,
    },
  )
}

export function buildAgentsSelectedTraceEvent(params: {
  step: number
  domainHint: Domain
  selectedAgentIds: string[]
  collaborationCap: number
  reason: string
}): DecisionTraceEvent {
  const { step, domainHint, selectedAgentIds, collaborationCap, reason } = params
  return createDecisionTraceEvent(
    step,
    'agents_selected',
    `Agenti selezionati per ${domainHint}: ${selectedAgentIds.join(', ')}`,
    {
      domainHint,
      selectedAgentIds,
      collaborationCap,
      reason,
    },
  )
}
