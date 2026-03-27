import type { AgentProfile, Domain } from '../types'

type DomainMappedAgent = Pick<AgentProfile, 'domainTags'> & Partial<Pick<AgentProfile, 'primaryDomain'>>

function isSpecificDomain(domain: Domain | null | undefined): domain is Domain {
  return !!domain && domain !== 'general' && domain !== 'coordination'
}

export function agentSupportsDomain(
  agent: DomainMappedAgent | null | undefined,
  domain: Domain | null | undefined,
): boolean {
  if (!agent || !domain) return false
  if (domain === 'general') return true
  return agent.domainTags.includes(domain)
}

export function getAgentPrimaryDomain(agent: DomainMappedAgent | null | undefined): Domain {
  if (!agent) return 'general'

  if (agent.primaryDomain && agent.domainTags.includes(agent.primaryDomain)) {
    return agent.primaryDomain
  }

  const preferredSpecific = agent.domainTags.find(isSpecificDomain)
  if (preferredSpecific) return preferredSpecific

  const firstNonCoordination = agent.domainTags.find((domain) => domain !== 'coordination')
  if (firstNonCoordination) return firstNonCoordination

  return agent.domainTags[0] ?? 'general'
}

export function resolveAgentRuntimeDomain(
  agent: DomainMappedAgent | null | undefined,
  options?: {
    preferredDomain?: Domain | null
    fallbackDomain?: Domain | null
  },
): Domain {
  if (!agent) return options?.fallbackDomain ?? options?.preferredDomain ?? 'general'

  if (isSpecificDomain(options?.preferredDomain) && agentSupportsDomain(agent, options?.preferredDomain)) {
    return options.preferredDomain
  }

  const primaryDomain = getAgentPrimaryDomain(agent)
  if (isSpecificDomain(primaryDomain)) return primaryDomain

  if (isSpecificDomain(options?.fallbackDomain) && agentSupportsDomain(agent, options?.fallbackDomain)) {
    return options.fallbackDomain
  }

  if (agentSupportsDomain(agent, options?.preferredDomain)) {
    return options?.preferredDomain ?? primaryDomain
  }

  if (agentSupportsDomain(agent, options?.fallbackDomain)) {
    return options?.fallbackDomain ?? primaryDomain
  }

  return primaryDomain
}
