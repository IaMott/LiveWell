import { describe, expect, it, vi } from 'vitest'
import {
  executeAgentRounds,
  type AgentRoundExecutionResult,
} from '@/lib/ai/orchestrator/agentRoundExecution'
import type { AgentInput, AgentProfile } from '@/lib/ai/types'

const selectedAgents: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health'],
    systemPrompt: 'system-mmg',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
  {
    id: 'dietista',
    displayName: 'Dietista',
    domainTags: ['nutrition'],
    systemPrompt: 'system-dietista',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
]

const input: AgentInput = {
  requestId: 'req-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  message: 'Ho mal di schiena e mangio male',
  contextPack: {
    user: { id: 'user-1', role: 'USER', profile: {}, attributes: {} },
    history: { recentMessages: [], recentArtifacts: [] },
    trackers: {},
    notifications: { unreadCount: 0 },
    ui: { moodScore: 50 },
  },
}

describe('agent round execution boundary', () => {
  it('returns structured round1 and round2 proposals', async () => {
    const llm = {
      complete: vi
        .fn()
        .mockImplementation(async ({ system, user }: { system: string; user: string }) => {
          const isRound2 = user.includes('PEER REVIEW (round 2):')
          const summaryBase = system === 'system-mmg' ? 'mmg' : 'dietista'
          return {
            text: JSON.stringify({
              domain: 'health',
              summary: isRound2 ? `${summaryBase}-round2` : `${summaryBase}-round1`,
              reasoning: 'ok',
              questions: [],
              recommendations: [],
              toolCalls: [],
              confidence: 0.8,
            }),
          }
        }),
    }

    const out: AgentRoundExecutionResult = await executeAgentRounds({
      llm,
      selectedAgents,
      input,
      domainHint: 'health',
    })

    expect(out.round1Proposals.map((p) => p.summary)).toEqual(['mmg-round1', 'dietista-round1'])
    expect(out.round2Proposals.map((p) => p.summary)).toEqual(['mmg-round2', 'dietista-round2'])
    expect(llm.complete).toHaveBeenCalledTimes(4)
  })

  it('packages peer insights into round2 execution prompts', async () => {
    const llm = {
      complete: vi
        .fn()
        .mockImplementation(async ({ system, user }: { system: string; user: string }) => {
          const isRound2 = user.includes('PEER REVIEW (round 2):')
          const summaryBase = system === 'system-mmg' ? 'mmg' : 'dietista'
          return {
            text: JSON.stringify({
              domain: 'health',
              summary: isRound2 ? `${summaryBase}-round2` : `${summaryBase}-round1`,
              reasoning: 'ok',
              questions: [],
              recommendations: [],
              toolCalls: [],
              confidence: 0.8,
            }),
          }
        }),
    }

    await executeAgentRounds({
      llm,
      selectedAgents,
      input,
      domainHint: 'health',
    })

    const calls = vi.mocked(llm.complete).mock.calls
    const round2Users = calls.slice(2).map((call) => call[0].user)

    expect(round2Users[0]).toContain('PEER REVIEW (round 2):')
    expect(round2Users[0]).toContain('- dietista: dietista-round1')
    expect(round2Users[0]).not.toContain('- mmg: mmg-round1')

    expect(round2Users[1]).toContain('PEER REVIEW (round 2):')
    expect(round2Users[1]).toContain('- mmg: mmg-round1')
    expect(round2Users[1]).not.toContain('- dietista: dietista-round1\n- dietista')
  })

  it('does not inject peer review when there are no peer summaries', async () => {
    const llm = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          domain: 'health',
          summary: 'solo',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [],
          confidence: 0.8,
        }),
      }),
    }

    await executeAgentRounds({
      llm,
      selectedAgents: [selectedAgents[0]],
      input,
      domainHint: 'health',
    })

    const round2User = vi.mocked(llm.complete).mock.calls[1]?.[0].user ?? ''
    expect(round2User).not.toContain('PEER REVIEW (round 2):')
  })
})
