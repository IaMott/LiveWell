import { describe, expect, it } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentProfile, ContextPack, DecisionTraceEvent } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
  {
    id: 'fisioterapista',
    displayName: 'Fisioterapista',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
  {
    id: 'fisiatra',
    displayName: 'Fisiatra',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
]

const contextPack: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50, health: 60 } },
}

describe('orchestrator decision trace foundation', () => {
  it('emits ordered, serializable routing decision trace events', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'Procediamo.' }
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: 'ok',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-trace',
        userId: 'u1',
        conversationId: 'c1',
        message: 'voglio parlare con il fisioterapista',
        domainHint: 'health',
        contextPack,
      },
    )

    const trace = out.debug?.decisionTrace as DecisionTraceEvent[] | undefined

    expect(trace?.map((event) => event.kind)).toEqual([
      'domain_detected',
      'specialist_mode_resolved',
      'agents_selected',
    ])
    expect(trace?.map((event) => event.step)).toEqual([1, 2, 3])
    expect(JSON.parse(JSON.stringify(trace ?? []))).toEqual(trace ?? [])

    expect(trace?.[0]?.data).toMatchObject({
      detectedDomain: 'health',
      source: 'input.domainHint',
    })
    expect(trace?.[1]?.data).toMatchObject({
      previousActiveSpecialistId: null,
      requestedSpecialistId: 'fisioterapista',
      activeSpecialistId: 'fisioterapista',
      exitSpecialistMode: false,
    })
    expect(trace?.[2]?.data).toMatchObject({
      domainHint: 'health',
      selectedAgentIds: ['fisioterapista', 'fisiatra', 'mmg'],
      collaborationCap: 3,
    })
  })
})
