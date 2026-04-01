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
          const isRound2 = user.includes('=== ANALISI DEI COLLEGHI SPECIALISTI')
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
    // MAX_PEER_REVIEW_PHASES=2 → 3 total phases: 1 briefing + 2 peer review = 6 calls
    expect(llm.complete).toHaveBeenCalledTimes(6)
  })

  it('packages peer insights into round2 execution prompts', async () => {
    const llm = {
      complete: vi
        .fn()
        .mockImplementation(async ({ system, user }: { system: string; user: string }) => {
          const isRound2 = user.includes('=== ANALISI DEI COLLEGHI SPECIALISTI')
          const agentId = system === 'system-mmg' ? 'mmg' : 'dietista'
          return {
            text: JSON.stringify({
              domain: 'health',
              summary: isRound2 ? `${agentId}-round2` : `${agentId}-round1`,
              // Reasoning univoco e > 10 chars → verrà incluso nei peer insights del collega
              reasoning: `REASONING_FROM_${agentId}_R1`,
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

    // Nuovo formato: usa "=== ANALISI DEI COLLEGHI SPECIALISTI" e "### AGENTID"
    expect(round2Users[0]).toContain('=== ANALISI DEI COLLEGHI SPECIALISTI')
    // mmg vede il peer dietista (il reasoning di dietista appare nel suo prompt)
    expect(round2Users[0]).toContain('REASONING_FROM_dietista_R1')
    // mmg NON vede se stesso
    expect(round2Users[0]).not.toContain('REASONING_FROM_mmg_R1')

    expect(round2Users[1]).toContain('=== ANALISI DEI COLLEGHI SPECIALISTI')
    // dietista vede il peer mmg (il reasoning di mmg appare nel suo prompt)
    expect(round2Users[1]).toContain('REASONING_FROM_mmg_R1')
    // dietista NON vede se stesso
    expect(round2Users[1]).not.toContain('REASONING_FROM_dietista_R1')
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
    expect(round2User).not.toContain('=== ANALISI DEI COLLEGHI SPECIALISTI')
  })
})
