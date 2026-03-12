import { describe, expect, it } from 'vitest'
import type { AgentProfile } from '@/lib/ai/types'
import { resolveRoutingContext } from '@/lib/ai/orchestrator/routing'

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  },
  {
    id: 'fisioterapista',
    displayName: 'Fisioterapista',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  },
  {
    id: 'fisiatra',
    displayName: 'Fisiatra',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  },
  {
    id: 'medico-dello-sport',
    displayName: 'Medico dello Sport',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  },
  {
    id: 'dietista',
    displayName: 'Dietista',
    domainTags: ['nutrition'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  },
]

describe('orchestrator routing phase1 extraction', () => {
  it('locks the requested specialist and keeps it first in selectedAgents', () => {
    const out = resolveRoutingContext({
      team,
      message: 'voglio parlare con il fisioterapista',
      detectedDomain: 'general',
      allDomains: ['general'],
    })

    expect(out.activeSpecialist?.id).toBe('fisioterapista')
    expect(out.domainHint).toBe('training')
    expect(out.selectedAgents[0]?.id).toBe('fisioterapista')
  })

  it('exits specialist mode when the user explicitly asks to return to the team', () => {
    const out = resolveRoutingContext({
      team,
      message: 'torna al team',
      detectedDomain: 'health',
      allDomains: ['health'],
      activeSpecialistId: 'fisioterapista',
    })

    expect(out.activeSpecialist).toBeUndefined()
    expect(out.domainHint).toBe('health')
    expect(out.selectedAgents.length).toBe(4)
  })

  it('keeps the locked specialist first and caps collaboration to three agents', () => {
    const out = resolveRoutingContext({
      team,
      message: 'ho mal di schiena e vorrei capire come allenarmi',
      detectedDomain: 'health',
      allDomains: ['health', 'training'],
      activeSpecialistId: 'fisioterapista',
    })

    expect(out.activeSpecialist?.id).toBe('fisioterapista')
    expect(out.selectedAgents[0]?.id).toBe('fisioterapista')
    expect(out.selectedAgents.length).toBeLessThanOrEqual(3)
    expect(out.selectedAgents.map((agent) => agent.id)).toEqual([
      'fisioterapista',
      'fisiatra',
      'medico-dello-sport',
    ])
  })
})
