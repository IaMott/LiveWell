import type {
  ActiveSpecialist,
  AgentProfile,
  ContextPack,
  DecisionTraceEvent,
  Domain,
} from '../types'
import { selectAgentsForRequest } from './agentSelection'
import {
  buildAgentsSelectedTraceEvent,
  buildSpecialistModeResolvedTraceEvent,
} from './decisionTrace'
import {
  detectMultiSpecialistNeed,
  detectSpecialistRequest,
  shouldExitSpecialistMode,
} from './routing'

/** Build a flat string from user attributes for competence scoring against case state. */
function buildCaseContextFromAttributes(contextPack: ContextPack): string {
  const attrs = contextPack.user?.attributes
  if (!attrs) return ''
  const parts: string[] = []
  for (const domainAttrs of Object.values(attrs)) {
    if (!domainAttrs || typeof domainAttrs !== 'object') continue
    for (const [key, attr] of Object.entries(domainAttrs as Record<string, { value: unknown }>)) {
      if (attr?.value != null) parts.push(`${key} ${String(attr.value)}`)
    }
  }
  return parts.join(' ')
}

function pickSpecialistEffectiveDomain(
  activeSpecialist: ActiveSpecialist | undefined,
  detectedDomain: Domain,
): Domain {
  if (!activeSpecialist) return detectedDomain
  const domains = activeSpecialist.domains ?? [activeSpecialist.domain]
  if (domains.includes(detectedDomain)) return detectedDomain
  const preferred = domains.find((domain) => domain !== 'general' && domain !== 'coordination')
  return preferred ?? activeSpecialist.domain
}

export type ResolveRoutingParams = {
  team: AgentProfile[]
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  activeSpecialistId?: string
  contextPack?: ContextPack
}

export type RoutingResolution = {
  activeSpecialist?: ActiveSpecialist
  domainHint: Domain
  selectedAgents: AgentProfile[]
  decisionTrace: DecisionTraceEvent[]
}

export function resolveRoutingContext(params: ResolveRoutingParams): RoutingResolution {
  const { team, message, detectedDomain, allDomains, activeSpecialistId, contextPack } = params
  const decisionTrace: DecisionTraceEvent[] = []

  const caseContext = contextPack ? buildCaseContextFromAttributes(contextPack) : ''
  const agentFeedbackScores = contextPack?.routing?.agentFeedbackScores ?? {}

  let lockedAgentId = activeSpecialistId ?? null
  const requestedSpecialistId = detectSpecialistRequest(message, team)
  const exitSpecialistMode = Boolean(lockedAgentId && shouldExitSpecialistMode(message))

  if (exitSpecialistMode) lockedAgentId = null
  if (!lockedAgentId && requestedSpecialistId) lockedAgentId = requestedSpecialistId

  let activeSpecialist: ActiveSpecialist | undefined
  if (lockedAgentId) {
    const agent = team.find((candidate) => candidate.id === lockedAgentId)
    if (agent) {
      activeSpecialist = {
        id: agent.id,
        displayName: agent.displayName,
        domain: (agent.domainTags[0] ?? detectedDomain) as Domain,
        domains: agent.domainTags,
        runtimeCapabilities: agent.runtimeCapabilities,
      }
    }
  }

  const domainHint = pickSpecialistEffectiveDomain(activeSpecialist, detectedDomain)
  const clusterMatch = !activeSpecialist ? detectMultiSpecialistNeed(message, team) : null

  const selectedAgents = activeSpecialist
    ? (() => {
        const base = selectAgentsForRequest(
          team,
          domainHint,
          6,
          allDomains,
          message,
          caseContext,
          agentFeedbackScores,
        ).filter((agent) => agent.id !== 'orchestratore')
        const ordered = [
          team.find((agent) => agent.id === activeSpecialist?.id),
          ...base.filter((agent) => agent.id !== activeSpecialist?.id),
        ].filter((agent): agent is AgentProfile => Boolean(agent))
        return ordered.slice(0, 3)
      })()
    : clusterMatch
      ? (() => {
          const domainScored = selectAgentsForRequest(
            team,
            domainHint,
            6,
            allDomains,
            message,
            caseContext,
            agentFeedbackScores,
          )
          const clusterIds = new Set(clusterMatch.specialists.map((s) => s.id))
          const clusterFirst: AgentProfile[] =
            clusterMatch.urgency === 'alta'
              ? clusterMatch.specialists
              : clusterMatch.specialists.slice(0, 2)
          const fillers = domainScored.filter((a) => !clusterIds.has(a.id))
          return [...clusterFirst, ...fillers].slice(0, 6)
        })()
      : selectAgentsForRequest(
          team,
          domainHint,
          4,
          allDomains,
          message,
          caseContext,
          agentFeedbackScores,
        )

  const specialistReason = exitSpecialistMode
    ? 'explicit_exit_request'
    : requestedSpecialistId
      ? 'explicit_specialist_request'
      : activeSpecialistId && activeSpecialist
        ? 'keep_previous_specialist'
        : 'no_specialist_lock'

  decisionTrace.push(
    buildSpecialistModeResolvedTraceEvent({
      step: 2,
      requestedSpecialistId,
      previousActiveSpecialistId: activeSpecialistId ?? null,
      activeSpecialist,
      exitSpecialistMode,
      reason: specialistReason,
    }),
  )

  decisionTrace.push(
    buildAgentsSelectedTraceEvent({
      step: 3,
      domainHint,
      selectedAgentIds: selectedAgents.map((agent) => agent.id),
      collaborationCap: activeSpecialist ? 3 : clusterMatch ? 6 : 4,
      reason: activeSpecialist
        ? 'specialist_first_collaboration'
        : clusterMatch
          ? `symptom_cluster_routing_urgency_${clusterMatch.urgency}`
          : 'domain_based_selection',
    }),
  )

  return {
    activeSpecialist,
    domainHint,
    selectedAgents,
    decisionTrace,
  }
}
