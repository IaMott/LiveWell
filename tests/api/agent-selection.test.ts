import { describe, expect, it } from 'vitest'
import { selectAgentsForRequest } from '@/lib/ai/orchestrator/agentSelection'
import type { AgentProfile } from '@/lib/ai/types'

const mk = (
  id: string,
  displayName: string,
  domainTags: AgentProfile['domainTags'],
): AgentProfile => ({
  id,
  displayName,
  domainTags,
  systemPrompt: 'x',
  toolsAllowed: [],
  decisionStyle: 'team-led',
})

describe('selectAgentsForRequest', () => {
  it('prioritizes agents covering multiple relevant domains', () => {
    const team: AgentProfile[] = [
      mk('cardiologo', 'Cardiologo', ['health']),
      mk('gastroenterologo', 'Gastroenterologo', ['health']),
      mk('fisioterapista', 'Fisioterapista', ['training', 'health']),
      mk('dietista', 'Dietista', ['nutrition']),
    ]

    const picked = selectAgentsForRequest(
      team,
      'health',
      2,
      ['health', 'training'],
      'ho mal di schiena da 3 giorni',
    )

    expect(picked.map((a) => a.id)).toContain('fisioterapista')
    expect(picked.length).toBe(2)
  })

  it('prioritizes competence for back-pain over generic same-domain specialists', () => {
    const team: AgentProfile[] = [
      mk('cardiologo', 'Cardiologo', ['health']),
      mk('gastroenterologo', 'Gastroenterologo', ['health']),
      mk('fisioterapista', 'Fisioterapista', ['training', 'health']),
      mk('fisiatra', 'Fisiatra', ['training', 'health']),
    ]

    const picked = selectAgentsForRequest(
      team,
      'health',
      2,
      ['health'],
      'ho mal di schiena lombare da 3 giorni, peggiora quando mi piego',
    )

    expect(picked[0]?.id).toBe('fisioterapista')
    expect(picked.map((a) => a.id)).toContain('fisiatra')
    expect(picked.map((a) => a.id)).not.toContain('cardiologo')
  })
})
