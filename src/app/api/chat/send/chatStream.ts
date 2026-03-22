import type { AgentProposal, Domain } from '@/lib/ai/types'

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
  userMessage?: string,
  userName?: string | null,
): Array<{ specialistName: string; title: string; domain?: Domain; thought?: string }> {
  const name = userName ?? "l'utente"
  const msgPreview = userMessage ? userMessage.slice(0, 42).trim() : ''

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

    for (const p of proposals) {
      const agent = team.find((a) => a.id === p.agentId)
      const agentName = agent?.displayName ?? p.agentId
      const domain = p.domain

      // Step A: interpreting the user message
      if (msgPreview) {
        steps.push({
          specialistName: agentName,
          title: `${name}: "${msgPreview}${msgPreview.length >= 42 ? '…' : ''}"`,
          domain,
          thought: 'Sta valutando la richiesta',
        })
      }

      // Step B: what the agent found / needs — use actual proposal content
      const hasQuestions = p.questions && p.questions.length > 0
      const hasSummary = p.summary && !p.summary.toLowerCase().includes('[unavailable]')
      const hasReasoning = p.reasoning && p.reasoning.length > 5

      if (hasQuestions && p.questions) {
        const q = p.questions[0].slice(0, 58)
        steps.push({
          specialistName: agentName,
          title: `da raccogliere: ${q}${p.questions[0].length > 58 ? '…' : ''}`,
          domain,
          thought:
            hasReasoning && p.reasoning
              ? p.reasoning.slice(0, 120).replace(/\n/g, ' ')
              : 'Profilo incompleto — identifico i dati mancanti',
        })
      } else if (hasSummary && p.summary) {
        const preview = p.summary.slice(0, 62).replace(/\n/g, ' ')
        steps.push({
          specialistName: agentName,
          title: preview + (p.summary.length > 62 ? '…' : ''),
          domain,
          thought:
            hasReasoning && p.reasoning
              ? p.reasoning.slice(0, 120).replace(/\n/g, ' ')
              : p.summary.slice(0, 120).replace(/\n/g, ' '),
        })
      } else {
        steps.push({
          specialistName: agentName,
          title: 'valuto il profilo e il contesto',
          domain,
          thought:
            hasReasoning && p.reasoning
              ? p.reasoning.slice(0, 120).replace(/\n/g, ' ')
              : 'Verifico le informazioni nel profilo',
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
          title: `mi confronto con ${primary.displayName}`,
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
        title: msgPreview
          ? `analisi: "${msgPreview}${msgPreview.length >= 42 ? '…' : ''}"`
          : 'Valutazione specialistica in corso',
        domain: agent?.domainTags?.[0],
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
