import type { AgentProfile, CanonicalCaseStateSnapshot, Domain, ToolCall } from '@/lib/ai/types'

function normalizeToolDomain(value: string | null | undefined): Domain | null {
  if (
    value === 'general' ||
    value === 'nutrition' ||
    value === 'health' ||
    value === 'training' ||
    value === 'mindfulness' ||
    value === 'inspiration' ||
    value === 'coordination'
  ) {
    return value
  }

  if (value === 'personal' || value === 'career' || value === 'financial') {
    return 'general'
  }

  return null
}

export function inferToolCallDomain(call: ToolCall): Domain | null {
  const prefixDomain = normalizeToolDomain(call.name.split('.')[0] ?? null)
  if (prefixDomain) return prefixDomain

  if (call.name === 'user.setAttribute' && call.args && typeof call.args === 'object') {
    return normalizeToolDomain((call.args as { domain?: string }).domain)
  }

  return null
}

export function resolveToolExecutionAgent(params: {
  call: ToolCall
  team: AgentProfile[]
  stateSnapshot?: CanonicalCaseStateSnapshot | null
  activeSpecialistId?: string | null
  selectedAgentIds?: string[]
}): AgentProfile | undefined {
  const leadPanel =
    params.stateSnapshot?.domainPanels.find(
      (panel) => panel.domain === params.stateSnapshot?.leadDomain,
    ) ?? params.stateSnapshot?.domainPanels[0]
  const callDomain = inferToolCallDomain(params.call)
  const callPanel =
    params.stateSnapshot?.domainPanels.find((panel) => panel.domain === callDomain) ?? leadPanel

  const candidateAgentIds = [
    callPanel?.selectedAgentId,
    leadPanel?.selectedAgentId,
    params.activeSpecialistId,
    params.selectedAgentIds?.[0],
    'orchestratore',
  ].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index)

  return (
    candidateAgentIds
      .map((agentId) => params.team.find((agent) => agent.id === agentId))
      .find(
        (agent) =>
          agent &&
          (agent.toolsAllowed.length === 0 ||
            agent.toolsAllowed.some((toolName) => toolName === params.call.name)),
      ) ?? params.team.find((agent) => agent.id === candidateAgentIds[0])
  )
}
