import type { AgentProfile, AgentProposal, ContextPack, Domain } from '../types'
import { agentSupportsArtifactStorageType } from '../capabilities/registry'

export type GovernedArtifact = {
  type: 'nutrition' | 'training' | 'mindfulness' | 'other'
  title: string
  contentMarkdown: string
}

const STORAGE_DOMAIN_MAP: Partial<Record<GovernedArtifact['type'], Domain>> = {
  nutrition: 'nutrition',
  training: 'training',
  mindfulness: 'mindfulness',
}

function meetsArtifactPrerequisites(
  agent: AgentProfile | undefined,
  artifactType: GovernedArtifact['type'],
  contextPack: ContextPack | undefined,
): boolean {
  if (!agent) return false
  if (!contextPack) return true
  const runtimeCapabilities = agent.runtimeCapabilities
  const requiredInputs = runtimeCapabilities?.minimumInput ?? []
  const domain = STORAGE_DOMAIN_MAP[artifactType]

  if (!domain || requiredInputs.length === 0) return true

  const missingKeys = contextPack.user.medicalRecord?.missingKeys?.[domain] ?? []
  return missingKeys.length === 0
}

export function collectGovernedArtifacts(params: {
  team: AgentProfile[]
  proposals: AgentProposal[]
  contextPack?: ContextPack
}): GovernedArtifact[] {
  const out: GovernedArtifact[] = []
  const seen = new Set<string>()

  for (const proposal of params.proposals) {
    const agent = params.team.find((candidate) => candidate.id === proposal.agentId)
    for (const recommendation of proposal.recommendations ?? []) {
      for (const artifact of recommendation.artifactsToSave ?? []) {
        const title = artifact.title.trim()
        const contentMarkdown = artifact.contentMarkdown.trim()
        if (!title || !contentMarkdown) continue
        if (!agentSupportsArtifactStorageType(agent, artifact.type)) continue
        if (!meetsArtifactPrerequisites(agent, artifact.type, params.contextPack)) continue
        const key = `${proposal.agentId}:${artifact.type}:${title.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
          type: artifact.type,
          title,
          contentMarkdown,
        })
        if (out.length >= 5) return out
      }
    }
  }

  return out
}
