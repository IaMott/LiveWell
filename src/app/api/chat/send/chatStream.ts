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

/** Short thought previews per domain — shown next to agent name during SSE streaming */
const THINKING_THOUGHTS: Record<string, string[]> = {
  nutrition: [
    'Analizzando il profilo nutrizionale…',
    'Calcolando il fabbisogno energetico…',
    'Verificando macro e micronutrienti…',
  ],
  nutrizione: [
    'Analizzando il profilo nutrizionale…',
    'Calcolando il fabbisogno energetico…',
    'Verificando macro e micronutrienti…',
  ],
  training: [
    'Valutando capacità fisica e obiettivi…',
    'Elaborando piano di progressione…',
    'Controllando carico e recupero…',
  ],
  allenamento: [
    'Valutando capacità fisica e obiettivi…',
    'Elaborando piano di progressione…',
    'Controllando carico e recupero…',
  ],
  health: [
    'Analizzando parametri vitali…',
    'Verificando indicatori di rischio…',
    'Confrontando con range clinici…',
  ],
  'salute-biologica': [
    'Analizzando parametri vitali…',
    'Verificando indicatori di rischio…',
    'Confrontando con range clinici…',
  ],
  mindfulness: [
    'Valutando livello di stress…',
    'Analizzando qualità del sonno…',
    'Elaborando strategie di recupero…',
  ],
  inspiration: [
    'Analizzando contesto e obiettivi…',
    'Valutando opzioni strategiche…',
    'Elaborando piano di azione\u2026',
  ],
  idee: ['Analizzando contesto e obiettivi…', 'Valutando opzioni strategiche…'],
  coordination: ['Coordinando risposte del team…', 'Valutando contesto complessivo…'],
  general: ['Elaborazione in corso…', 'Analizzando il messaggio…'],
}

function getThought(domain: string | undefined, index: number): string {
  const key = domain ?? 'general'
  const thoughts = THINKING_THOUGHTS[key] ?? THINKING_THOUGHTS.general
  return thoughts[index % thoughts.length] ?? 'Elaborazione in corso…'
}

export function buildThinkingEvents(
  consensus: {
    debug?: { round1Proposals?: AgentProposal[]; selectedAgents?: string[] }
  },
  team: Array<{ id: string; displayName: string; domainTags: Domain[] }>,
): Array<{ specialistName: string; title: string; domain?: Domain; thought?: string }> {
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
    return round1.slice(0, 3).map((p, i) => {
      const agent = team.find((a) => a.id === p.agentId)
      return {
        specialistName: agent?.displayName ?? p.agentId,
        title: normalizeTitle(p.summary),
        domain: p.domain,
        thought: getThought(p.domain, i),
      }
    })
  }

  const selected = consensus.debug?.selectedAgents ?? []
  return selected.slice(0, 3).map((agentId, i) => {
    const agent = team.find((a) => a.id === agentId)
    return {
      specialistName: agent?.displayName ?? agentId,
      title: 'Valutazione specialistica in corso',
      domain: agent?.domainTags?.[0],
      thought: getThought(agent?.domainTags?.[0], i),
    }
  })
}
