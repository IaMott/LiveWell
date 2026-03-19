import type { AgentProfile, Domain } from '../types'
import type { ArtifactStorageType, RuntimeCapabilityContract } from './contracts'

const ARTIFACT_DOMAIN_MAP: Partial<Record<ArtifactStorageType, Domain[]>> = {
  nutrition: ['nutrition'],
  training: ['training', 'health'],
  mindfulness: ['mindfulness', 'health'],
}

const DOMAIN_TRIGGER_KEYWORDS: Record<Domain, string[]> = {
  general: [],
  nutrition: ['nutrition', 'nutriz', 'dieta', 'dietista', 'chef', 'gastro'],
  health: ['health', 'salute', 'medic', 'sintomi', 'clin', 'fisiatra', 'mmg', 'cardi'],
  training: ['training', 'allen', 'workout', 'eserciz', 'fisioterap', 'chinesiolog'],
  mindfulness: ['mindfulness', 'stress', 'sonno', 'psicolog', 'mental', 'coach'],
  inspiration: ['inspiration', 'carriera', 'finanz', 'legale', 'organizz'],
  coordination: ['coordin', 'team', 'orchestr'],
}

const GENERIC_TRIGGER_PATTERN =
  /(fuori competenza|specialista|specialisti|co-gestione|invio|medico|psicologo|valutazione medica|stop e valutazione)/i

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
  message: string
}): boolean {
  return findPermanentHandoffTriggerReason(params) !== null
}

function getSupportingAgentsForDomain(team: AgentProfile[], domain: Domain): AgentProfile[] {
  return team.filter((agent) => agentSupportsDomain(agent, domain) && agent.id !== 'orchestratore')
}

function normalizeText(value: string): string {
  return value.toLowerCase()
}

function findMatchingTrigger(
  triggers: string[],
  detectedDomain: Domain,
  message: string,
  team: AgentProfile[],
): string | null {
  if (detectedDomain === 'general') return null
  const lowerMessage = normalizeText(message)
  const supportingAgents = getSupportingAgentsForDomain(team, detectedDomain)
  const keywords = [
    ...DOMAIN_TRIGGER_KEYWORDS[detectedDomain],
    ...supportingAgents.flatMap((agent) => [
      normalizeText(agent.id),
      normalizeText(agent.displayName),
      ...agent.domainTags.flatMap((tag) => DOMAIN_TRIGGER_KEYWORDS[tag] ?? [tag]),
    ]),
  ]

  for (const trigger of triggers) {
    const lowerTrigger = normalizeText(trigger)
    const mentionsDomain = keywords.some((keyword) => keyword && lowerTrigger.includes(keyword))
    const mentionsMessageSignal = keywords.some(
      (keyword) => keyword && lowerMessage.includes(keyword),
    )
    if (mentionsDomain && mentionsMessageSignal) return trigger
    if (mentionsDomain) return trigger
    if (GENERIC_TRIGGER_PATTERN.test(lowerTrigger)) return trigger
  }

  return null
}

function supportsArtifactDomain(agent: AgentProfile, storageType: ArtifactStorageType): boolean {
  const allowedDomains = ARTIFACT_DOMAIN_MAP[storageType]
  if (!allowedDomains) return true
  return agent.domainTags.some((domain) => allowedDomains.includes(domain))
}

export function findCapabilityConsultTarget(params: {
  team: AgentProfile[]
  ownerAgentId: string
  detectedDomain: Domain
  message: string
}): { agentId: string; reason: string } | null {
  const owner = params.team.find((agent) => agent.id === params.ownerAgentId)
  if (
    !owner ||
    params.detectedDomain === 'general' ||
    agentSupportsDomain(owner, params.detectedDomain)
  ) {
    return null
  }

  const consultTarget = getSupportingAgentsForDomain(params.team, params.detectedDomain).find(
    (agent) => agent.id !== params.ownerAgentId,
  )
  if (!consultTarget) return null

  const ownerContract = getAgentRuntimeContract(params.team, params.ownerAgentId)
  const targetContract = getAgentRuntimeContract(params.team, consultTarget.id)
  const ownerReason = findMatchingTrigger(
    ownerContract?.consultTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const targetReason = findMatchingTrigger(
    targetContract?.consultTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const contractsConfigured =
    (ownerContract?.consultTriggers.length ?? 0) > 0 ||
    (targetContract?.consultTriggers.length ?? 0) > 0

  if (contractsConfigured && !ownerReason && !targetReason) return null

  return {
    agentId: consultTarget.id,
    reason: ownerReason ?? targetReason ?? `capability_consult:${params.detectedDomain}`,
  }
}

export function findPermanentHandoffTriggerReason(params: {
  team: AgentProfile[]
  ownerAgentId: string
  consultTargetAgentId?: string
  detectedDomain: Domain
  message: string
}): string | null {
  const owner = params.team.find((agent) => agent.id === params.ownerAgentId)
  const consultTarget = params.team.find((agent) => agent.id === params.consultTargetAgentId)
  if (!consultTarget || params.detectedDomain === 'general') return null
  const domainShift =
    !agentSupportsDomain(owner, params.detectedDomain) &&
    agentSupportsDomain(consultTarget, params.detectedDomain)
  if (!domainShift) return null

  const ownerContract = getAgentRuntimeContract(params.team, params.ownerAgentId)
  const targetContract = getAgentRuntimeContract(params.team, consultTarget.id)
  const ownerReason = findMatchingTrigger(
    ownerContract?.handoffTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const targetReason = findMatchingTrigger(
    targetContract?.handoffTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const contractsConfigured =
    (ownerContract?.handoffTriggers.length ?? 0) > 0 ||
    (targetContract?.handoffTriggers.length ?? 0) > 0

  if (contractsConfigured && !ownerReason && !targetReason) return null

  return targetReason ?? ownerReason ?? `capability_handoff:${params.detectedDomain}`
}

export function agentSupportsArtifactStorageType(
  agent: AgentProfile | undefined,
  storageType: ArtifactStorageType,
): boolean {
  if (!agent) return false
  if (!supportsArtifactDomain(agent, storageType)) return false
  if (!hasRuntimeContract(agent)) return storageType === 'other'
  return agent.runtimeCapabilities.artifacts.some(
    (artifact) => artifact.storageType === storageType,
  )
}
