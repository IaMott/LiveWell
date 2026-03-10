import { describe, expect, it } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentProfile, ContextPack } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.updateProfile'],
    decisionStyle: 'team-led',
  },
  {
    id: 'fisioterapista',
    displayName: 'Fisioterapista',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.updateProfile'],
    decisionStyle: 'team-led',
  },
]

const baseContext: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

describe('orchestrator multi-round', () => {
  it('returns round1 and round2 proposals in debug payload', async () => {
    const llm = {
      complete: async ({ user }: { system: string; user: string }) => {
        const isRound2 = user.includes('PEER REVIEW (round 2)')
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: isRound2 ? 'round2 summary' : 'round1 summary',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.updateProfile'],
      },
      {
        requestId: 'r1',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ho dolore alla schiena',
        contextPack: baseContext,
      },
    )

    expect(result.debug?.round1Proposals?.length).toBeGreaterThan(0)
    expect(result.debug?.round2Proposals?.length).toBeGreaterThan(0)
  })
})
