import type { AgentProfile, AgentProposal } from '../types'
import { agentSupportsArtifactStorageType } from '../capabilities/registry'

export type GovernedArtifact = {
  type: 'nutrition' | 'training' | 'mindfulness' | 'other'
  title: string
  contentMarkdown: string
}

export function collectGovernedArtifacts(params: {
  team: AgentProfile[]
  proposals: AgentProposal[]
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
