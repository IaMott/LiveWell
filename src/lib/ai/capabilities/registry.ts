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
  health: [
    'health',
    'salute',
    'medic',
    'sintomi',
    'clin',
    'fisiatra',
    'mmg',
    'cardi',
    'dolore',
    'toracic',
    'petto',
    'fiato corto',
    'dispnea',
    'palpit',
  ],
  training: ['training', 'allen', 'workout', 'eserciz', 'fisioterap', 'chinesiolog'],
  mindfulness: [
    'mindfulness',
    'stress',
    'sonno',
    'ansia',
    'burnout',
    'insonnia',
    'psicolog',
    'mental',
    'coach',
  ],
  inspiration: ['inspiration', 'carriera', 'finanz', 'legale', 'organizz'],
  coordination: ['coordin', 'team', 'orchestr'],
}

const GENERIC_TRIGGER_PATTERN =
  /(fuori competenza|specialista|specialisti|co-gestione|invio|medico|psicologo|valutazione medica|stop e valutazione)/i

const TRIGGER_STOPWORDS = new Set([
  'della',
  'dello',
  'delle',
  'degli',
  'della',
  'delle',
  'della',
  'team',
  'caso',
  'utente',
  'specialista',
  'specialisti',
  'valutazione',
  'invio',
  'fuori',
  'competenza',
  'dominio',
  'quando',
  'diventa',
  'prevalente',
  'posso',
  'prendere',
  'carico',
])

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

function tokenizeMeaningfulTerms(value: string): string[] {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !TRIGGER_STOPWORDS.has(token))
}

function hasTextSignal(text: string, signals: string[]): boolean {
  const tokens = normalizeText(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  return signals.some((signal) => {
    if (signal.length === 0) return false
    if (signal.includes(' ')) return text.includes(signal)
    return tokens.some((token) => token.startsWith(signal))
  })
}

function getDetectedDomainSignals(
  detectedDomain: Domain,
  supportingAgents: AgentProfile[],
): string[] {
  const signals = [
    detectedDomain,
    ...DOMAIN_TRIGGER_KEYWORDS[detectedDomain],
    ...supportingAgents.flatMap((agent) => [
      normalizeText(agent.id),
      normalizeText(agent.displayName),
    ]),
  ]

  return [...new Set(signals.filter((signal) => signal.length >= 4))]
}

function getSharedMeaningfulTokens(trigger: string, message: string): string[] {
  const messageTokens = new Set(tokenizeMeaningfulTerms(message))
  return tokenizeMeaningfulTerms(trigger).filter((token) => messageTokens.has(token))
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
  const domainSignals = getDetectedDomainSignals(detectedDomain, supportingAgents)
  const messageMentionsDomain = hasTextSignal(lowerMessage, domainSignals)

  for (const trigger of triggers) {
    const lowerTrigger = normalizeText(trigger)
    const triggerMentionsDomain = hasTextSignal(lowerTrigger, domainSignals)
    const sharedTokens = getSharedMeaningfulTokens(trigger, message)
    const hasGenericConsultLanguage = GENERIC_TRIGGER_PATTERN.test(lowerTrigger)

    if (triggerMentionsDomain && messageMentionsDomain) return trigger
    if (sharedTokens.length > 0 && messageMentionsDomain && hasGenericConsultLanguage)
      return trigger
    if (sharedTokens.length >= 2) return trigger
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

  const consultTargets = getSupportingAgentsForDomain(params.team, params.detectedDomain).filter(
    (agent) => agent.id !== params.ownerAgentId,
  )
  if (consultTargets.length === 0) return null

  const ownerContract = getAgentRuntimeContract(params.team, params.ownerAgentId)
  const ownerReason = findMatchingTrigger(
    ownerContract?.consultTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const targetMatches = consultTargets
    .map((agent) => {
      const targetContract = getAgentRuntimeContract(params.team, agent.id)
      const reason = findMatchingTrigger(
        targetContract?.consultTriggers ?? [],
        params.detectedDomain,
        params.message,
        params.team,
      )
      return { agent, reason }
    })
    .filter((match) => Boolean(match.reason))
  const contractsConfigured =
    (ownerContract?.consultTriggers.length ?? 0) > 0 ||
    consultTargets.some(
      (agent) => (getAgentRuntimeContract(params.team, agent.id)?.consultTriggers.length ?? 0) > 0,
    )

  if (contractsConfigured && !ownerReason && targetMatches.length === 0) return null

  const ownerDirectedTarget =
    ownerReason == null
      ? null
      : consultTargets.find((agent) => {
          const lowerReason = normalizeText(ownerReason)
          return (
            lowerReason.includes(normalizeText(agent.id)) ||
            lowerReason.includes(normalizeText(agent.displayName))
          )
        })
  const selectedTarget = targetMatches[0]?.agent ?? ownerDirectedTarget ?? consultTargets[0]
  const selectedReason =
    targetMatches.find((match) => match.agent.id === selectedTarget.id)?.reason ??
    ownerReason ??
    `capability_consult:${params.detectedDomain}`

  return {
    agentId: selectedTarget.id,
    reason: selectedReason,
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
