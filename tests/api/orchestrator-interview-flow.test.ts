import { describe, expect, it } from 'vitest'
import { applyInterviewFlow } from '@/lib/ai/orchestrator/interviewFlow'
import type { AgentProposal, ContextPack } from '@/lib/ai/types'

const baseContext: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

const baseRound2Proposals: AgentProposal[] = [
  {
    agentId: 'dietista',
    domain: 'nutrition',
    summary: 'ok',
    reasoning: 'ok',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0.8,
  },
  {
    agentId: 'gastroenterologo',
    domain: 'nutrition',
    summary: 'ok',
    reasoning: 'ok',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0.7,
  },
]

describe('interview flow boundary', () => {
  it('returns one current question and preserves workspace queue order in pendingNext', () => {
    const contextPack: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        agentWorkspaces: [
          {
            agentId: 'dietista',
            round2Summary: 'pending',
            pendingDomain: 'nutrition',
            pendingQuestions: [
              'Hai allergie o intolleranze alimentari da registrare?',
              'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
            ],
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }

    const result = applyInterviewFlow({
      domain: 'nutrition',
      contextPack,
      userMessage: 'continuiamo con la nutrizione',
      consensusGatingQuestions: [],
      round2Proposals: baseRound2Proposals,
    })

    expect(result.finalInterviewQuestions).toEqual([
      'Hai allergie o intolleranze alimentari da registrare?',
    ])
    expect(result.round2WithQueue[0]?.pendingQuestions).toEqual([
      'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
    ])
    expect(result.round2WithQueue[0]?.pendingDomain).toBe('nutrition')
    expect(result.round2ForPersistence).toEqual(result.round2WithQueue)
  })

  it('adds a synthetic persistence proposal when no round2 proposal owns the queue', () => {
    const result = applyInterviewFlow({
      domain: 'nutrition',
      contextPack: baseContext,
      userMessage: 'voglio lavorare sulla nutrizione',
      consensusGatingQuestions: [],
      round2Proposals: [],
      activeSpecialist: {
        id: 'dietista',
        displayName: 'Dietista',
        domain: 'nutrition',
      },
    })

    expect(result.finalInterviewQuestions).toEqual([
      'Hai allergie o intolleranze alimentari da registrare?',
    ])
    expect(result.round2WithQueue).toEqual([])
    expect(result.round2ForPersistence).toHaveLength(1)
    expect(result.round2ForPersistence[0]).toMatchObject({
      agentId: 'dietista',
      domain: 'nutrition',
      pendingDomain: 'nutrition',
      pendingQuestions: [
        'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
      ],
    })
  })
})
