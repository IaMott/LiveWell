import type { AgentProposal, CanonicalCaseStateSnapshot, Domain } from '@/lib/ai/types'
import { resolveAgentRuntimeDomain } from '@/lib/ai/team/domainMapping'

export type ChatStreamEvent =
  | { type: 'message.delta'; id: string; delta: string }
  | {
      type: 'agent.thinking'
      specialistName: string
      title: string
      domain?: Domain
      /** Short preview of what this agent is currently doing */
      thought?: string
    }
  | {
      type: 'ui.state'
      domain: Domain
      moodScore: number
      sectionScores: Record<string, number>
      specialistName?: string
      activeSpecialistId?: string
      specialistDomains?: Domain[]
      stateSnapshot?: CanonicalCaseStateSnapshot
      /** S1: Sent so the client can sync the conversationId for newly-created conversations. */
      conversationId?: string
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
  | {
      type: 'message.suggestions'
      suggestions: Array<{
        id: string
        label: string
        text: string
        emoji?: string
        domain?: Domain
      }>
    }
  | { type: 'error'; code: string; message: string }

export function toSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Generates step-by-step thinking events from actual agent proposal data.
 *
 * Format (design spec):
 *   Nutrizionista → [user] vuole dimagrire
 *   Nutrizionista → verifico i dati disponibili nel profilo
 *   Nutrizionista → devo raccogliere: peso, altezza
 *   Personal Trainer → mi confronto con il Nutrizionista
 *   Team → sintesi e risposta finale
 */
export function buildThinkingEvents(
  consensus: {
    debug?: {
      round1Proposals?: AgentProposal[]
      selectedAgents?: string[]
    }
  },
  team: Array<{ id: string; displayName: string; domainTags: Domain[] }>,
  _userMessage?: string,
  _userName?: string | null,
): Array<{ specialistName: string; title: string; domain?: Domain; thought?: string }> {
  const round1 = consensus.debug?.round1Proposals ?? []
  const selectedIds = consensus.debug?.selectedAgents ?? []

  const proposals = round1.filter((p) => p.confidence !== 0).slice(0, 3)

  if (proposals.length > 0) {
    const steps: Array<{
      specialistName: string
      title: string
      domain?: Domain
      thought?: string
    }> = []

    // Show the REAL specialist reasoning. Cascade through all available sources.
    for (const p of proposals) {
      const agent = team.find((a) => a.id === p.agentId)
      const agentName = agent?.displayName ?? p.agentId
      const domain = p.domain

      const hasSummary =
        !!p.summary && !p.summary.toLowerCase().includes('[unavailable]') && p.summary.length > 2
      const hasReasoning = !!p.reasoning && p.reasoning.length > 5
      const hasRecommendations = !!p.recommendations && p.recommendations.length > 0
      const hasQuestions = !!p.questions && p.questions.length > 0

      // Best available thought text — prefer reasoning, then summary, then recommendation rationale
      const fullThought = hasReasoning
        ? p.reasoning!.replace(/\n/g, ' ')
        : hasSummary
          ? p.summary!.replace(/\n/g, ' ')
          : hasRecommendations
            ? (p.recommendations![0].rationale || p.recommendations![0].title).replace(/\n/g, ' ')
            : 'Verifico le informazioni nel profilo'

      if (hasQuestions && p.questions) {
        steps.push({
          specialistName: agentName,
          title: `Da raccogliere: ${p.questions[0]}`,
          domain,
          thought: fullThought,
        })
      } else if (hasSummary && p.summary) {
        steps.push({
          specialistName: agentName,
          title: p.summary.replace(/\n/g, ' '),
          domain,
          thought: fullThought,
        })
      } else if (hasRecommendations) {
        steps.push({
          specialistName: agentName,
          title: p.recommendations![0].title.replace(/\n/g, ' '),
          domain,
          thought: fullThought,
        })
      } else {
        steps.push({
          specialistName: agentName,
          title: 'Valuto il profilo e il contesto',
          domain,
          thought: fullThought,
        })
      }

      if (steps.length >= 5) break
    }

    // Cross-agent consultation step (when >1 specialist)
    if (proposals.length > 1 && steps.length < 5) {
      const primary = team.find((a) => a.id === proposals[0].agentId)
      const secondary = team.find((a) => a.id === proposals[1].agentId)
      if (primary && secondary) {
        steps.push({
          specialistName: secondary.displayName,
          title: `Mi confronto con ${primary.displayName}`,
          domain: proposals[1].domain,
          thought: 'Scambio di informazioni tra specialisti del team',
        })
      }
    }

    return steps.slice(0, 5)
  }

  // Fallback: selected agent IDs without proposal data
  if (selectedIds.length > 0) {
    return selectedIds.slice(0, 3).map((agentId) => {
      const agent = team.find((a) => a.id === agentId)
      return {
        specialistName: agent?.displayName ?? agentId,
        title: 'Valutazione specialistica in corso',
        domain: resolveAgentRuntimeDomain(agent),
        thought: 'Elaborazione in corso',
      }
    })
  }

  return []
}

export function mergeThinkingEvents<
  T extends { specialistName: string; title: string; domain?: Domain; thought?: string },
>(primary: T[], secondary: T[], limit = 5): T[] {
  const merged: T[] = []
  const seen = new Set<string>()

  for (const event of [...primary, ...secondary]) {
    const key = `${event.specialistName}:${event.title}:${event.thought ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(event)
    if (merged.length >= limit) break
  }

  return merged
}
