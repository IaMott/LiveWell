import type { ActiveSpecialist, AgentProfile, Domain } from '../types'
import { CaseState } from './state'

export function deriveActiveSpecialistFromCaseState(
  caseState: CaseState | null,
  team: AgentProfile[],
): ActiveSpecialist | undefined {
  if (!caseState) return undefined
  if (
    caseState.protocolState !== 'consult_active_takeover' &&
    caseState.protocolState !== 'handoff_pending_user' &&
    caseState.consultReason !== 'explicit_initial_owner' &&
    caseState.consultReason !== 'permanent_handoff'
  ) {
    return undefined
  }
  const agent = team.find((candidate) => candidate.id === caseState.activeSpeakerAgentId)
  if (!agent) return undefined

  return {
    id: agent.id,
    displayName: agent.displayName,
    domain: (agent.domainTags[0] ?? 'general') as Domain,
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
