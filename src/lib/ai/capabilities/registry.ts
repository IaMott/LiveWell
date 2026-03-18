import type { AgentProfile, Domain } from '../types'
import type { ArtifactStorageType, RuntimeCapabilityContract } from './contracts'

function hasRuntimeContract(agent: AgentProfile): agent is AgentProfile & {
  runtimeCapabilities: RuntimeCapabilityContract
} {
  return Boolean(agent.runtimeCapabilities)
}

export function getAgentRuntimeContract(
  team: AgentProfile[],
  agentId?: string | null,
): RuntimeCapabilityContract | undefined {
  if (!agentId) return undefined
  return team.find((agent) => agent.id === agentId)?.runtimeCapabilities
}

export function agentSupportsDomain(agent: AgentProfile | undefined, domain: Domain): boolean {
  if (!agent) return false
  return agent.domainTags.includes(domain) || domain === 'general'
}

export function shouldTriggerPermanentHandoff(params: {
  team: AgentProfile[]
  ownerAgentId: string
  consultTargetAgentId?: string
  detectedDomain: Domain
}): boolean {
  const owner = params.team.find((agent) => agent.id === params.ownerAgentId)
  const consultTarget = params.team.find((agent) => agent.id === params.consultTargetAgentId)
  if (!consultTarget || params.detectedDomain === 'general') return false
  return (
    !agentSupportsDomain(owner, params.detectedDomain) &&
    agentSupportsDomain(consultTarget, params.detectedDomain)
  )
}

export function agentSupportsArtifactStorageType(
  agent: AgentProfile | undefined,
  storageType: ArtifactStorageType,
): boolean {
  if (!agent) return false
  if (!hasRuntimeContract(agent)) return storageType === 'other'
  return agent.runtimeCapabilities.artifacts.some(
    (artifact) => artifact.storageType === storageType,
  )
}
