import type { AgentProposal, Domain } from '@/lib/ai/types'

export type ChatStreamEvent =
  | { type: 'message.delta'; id: string; delta: string }
  | {
      type: 'agent.thinking'
      specialistName: string
      title: string
      domain?: Domain
    }
  | {
      type: 'ui.state'
      domain: Domain
      moodScore: number
      sectionScores: Record<string, number>
      specialistName?: string
      activeSpecialistId?: string
      specialistDomains?: Domain[]
    }
  | {
      type: 'tool.result'
      toolCallId: string
      ok: boolean
      code?: string
      message?: string
      requiresUserConfirmation?: boolean
      confirmToken?: string
    }
  | { type: 'message.complete'; id: string; content: string }
  | { type: 'error'; code: string; message: string }

export function toSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export function buildThinkingEvents(
  consensus: {
    debug?: { round1Proposals?: AgentProposal[]; selectedAgents?: string[] }
  },
  team: Array<{ id: string; displayName: string; domainTags: Domain[] }>,
): Array<{ specialistName: string; title: string; domain?: Domain }> {
  const normalizeTitle = (value: string | undefined): string => {
    if (!value) return 'Analisi del caso in corso'
    const lower = value.toLowerCase()
    const summaryIdx = lower.lastIndexOf('summary')
    const preferred =
      summaryIdx >= 0
        ? value
            .slice(summaryIdx)
            .replace(/^[^:]*:\s*/i, '')
            .trim()
        : value
    const stripped = preferred
      .replace(/\bdomain\s*:\s*[^\n,]+/gi, ' ')
      .replace(/\bsummary\s*:/gi, ' ')
      .replace(/[{}[\]"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!stripped) return 'Analisi del caso in corso'
    return stripped.slice(0, 72)
  }

  const round1 = consensus.debug?.round1Proposals ?? []
  if (round1.length > 0) {
    return round1.slice(0, 3).map((p) => {
      const agent = team.find((a) => a.id === p.agentId)
      return {
        specialistName: agent?.displayName ?? p.agentId,
        title: normalizeTitle(p.summary),
        domain: p.domain,
      }
    })
  }

  const selected = consensus.debug?.selectedAgents ?? []
  return selected.slice(0, 3).map((agentId) => {
    const agent = team.find((a) => a.id === agentId)
    return {
      specialistName: agent?.displayName ?? agentId,
      title: 'Valutazione specialistica in corso',
      domain: agent?.domainTags?.[0],
    }
  })
}
