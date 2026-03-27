import { AgentProfile, AgentProposal, Domain } from '../types'
import { getAgentPrimaryDomain } from '../team/domainMapping'

export function pickPrimaryDomain(
  domainHint: Domain | undefined,
  proposals: AgentProposal[],
): Domain {
  if (domainHint && domainHint !== 'general') return domainHint
  const counts = new Map<Domain, number>()
  for (const p of proposals) counts.set(p.domain, (counts.get(p.domain) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted.length ? sorted[0][0] : 'general'
}

/** Normalize agent proposals to their primary domain; returns violations log. */
export function enforceDomainIsolation(
  proposals: AgentProposal[],
  team: AgentProfile[],
): { normalized: AgentProposal[]; violations: string[] } {
  const agentPrimaryDomain = new Map(team.map((a) => [a.id, getAgentPrimaryDomain(a)]))
  const violations: string[] = []
  const normalized = proposals.map((p) => {
    const expected = agentPrimaryDomain.get(p.agentId)
    const agent = team.find((candidate) => candidate.id === p.agentId)
    const agentSupportsProposalDomain = !!agent && agent.domainTags.includes(p.domain)
    if (
      expected &&
      expected !== 'general' &&
      !agentSupportsProposalDomain &&
      p.domain !== expected &&
      p.domain !== 'general'
    ) {
      violations.push(`Agent ${p.agentId} (${expected}) proposed domain ${p.domain} — normalized`)
      return { ...p, domain: expected as Domain }
    }
    return p
  })
  return { normalized, violations }
}
