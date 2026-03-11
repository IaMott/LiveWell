import { describe, expect, it } from 'vitest'
import { runConsensus } from '@/lib/ai/consensus/consensusEngine'
import type { AgentProfile, AgentProposal, ContextPack } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
]

const contextPack: ContextPack = {
  user: {
    id: 'u1',
    role: 'USER',
    profile: {},
    attributes: {
      health: {
        diagnosis: {
          value: 'lombalgia',
          recordedAt: new Date().toISOString(),
        },
      },
    },
  },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { health: 60 } },
}

describe('runConsensus known-data filtering with UserAttributes', () => {
  it('removes gating questions for already-known diagnosis from attributes', () => {
    const proposals: AgentProposal[] = [
      {
        agentId: 'mmg',
        domain: 'health',
        summary: 'Analisi salute',
        reasoning: 'x',
        questions: ['Hai già una diagnosi?', 'Da quanto tempo hai dolore?'],
        toolCalls: [],
      },
    ]

    const out = runConsensus({
      opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
      team,
      proposals,
      domainHint: 'health',
      contextPack,
      orchestratorToolsAllowed: [],
    })

    expect(out.gatingQuestions).toContain('Da quanto tempo hai dolore?')
    expect(out.gatingQuestions).not.toContain('Hai già una diagnosi?')
  })

  it('applies global interview policy: removes templates and keeps max one question', () => {
    const proposals: AgentProposal[] = [
      {
        agentId: 'mmg',
        domain: 'health',
        summary: 'Analisi salute',
        reasoning: 'x',
        questions: [
          'Quale area vuoi prioritizzare adesso: nutrizione, allenamento, salute o mindfulness?',
          'Qual è la tua altezza in cm?',
          'Da quanto tempo hai dolore?',
          'Hai diagnosi mediche già confermate o esami recenti utili?',
        ],
        toolCalls: [],
      },
    ]

    const out = runConsensus({
      opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
      team,
      proposals,
      domainHint: 'health',
      contextPack,
      orchestratorToolsAllowed: [],
    })

    expect((out.gatingQuestions ?? []).length).toBeLessThanOrEqual(1)
    expect(JSON.stringify(out.gatingQuestions ?? [])).not.toContain('Quale area vuoi prioritizzare')
    expect(JSON.stringify(out.gatingQuestions ?? [])).not.toContain('altezza')
  })
})
