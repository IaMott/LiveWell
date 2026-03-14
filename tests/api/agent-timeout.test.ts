import { describe, expect, it, vi } from 'vitest'
import { executeAgentRounds, AGENT_TIMEOUT_MS } from '@/lib/ai/orchestrator/agentRoundExecution'
import type { AgentInput, AgentProfile } from '@/lib/ai/types'

const makeAgent = (id: string): AgentProfile => ({
  id,
  displayName: id.toUpperCase(),
  domainTags: ['health'],
  systemPrompt: `system-${id}`,
  toolsAllowed: [],
  decisionStyle: 'team-led',
})

const input: AgentInput = {
  requestId: 'req-timeout',
  userId: 'user-1',
  conversationId: 'conv-1',
  message: 'test timeout',
  contextPack: {
    user: { id: 'user-1', role: 'USER', profile: {}, attributes: {} },
    history: { recentMessages: [], recentArtifacts: [] },
    trackers: {},
    notifications: { unreadCount: 0 },
    ui: { moodScore: 50 },
  },
}

const goodResponse = {
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

describe('agent timeout handling', () => {
  it('AGENT_TIMEOUT_MS is exported and a positive number', () => {
    expect(typeof AGENT_TIMEOUT_MS).toBe('number')
    expect(AGENT_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('returns fallback proposal with confidence=0 when agent times out', async () => {
    const SLOW_DELAY = 200
    const FAST_TIMEOUT = 50

    const llm = {
      complete: vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(goodResponse), SLOW_DELAY)),
        ),
    }

    const result = await executeAgentRounds({
      llm,
      selectedAgents: [makeAgent('slow-agent')],
      input,
      domainHint: 'health',
      timeoutMs: FAST_TIMEOUT,
    })

    // Should have fallback proposal with confidence 0
    expect(result.round1Proposals).toHaveLength(1)
    expect(result.round1Proposals[0]?.confidence).toBe(0)
    expect(result.round1Proposals[0]?.agentId).toBe('slow-agent')
    expect(result.round1Proposals[0]?.summary).toContain('[Unavailable]')
  }, 2000)

  it('completes normally when agents respond within timeout', async () => {
    const llm = {
      complete: vi.fn().mockResolvedValue(goodResponse),
    }

    const result = await executeAgentRounds({
      llm,
      selectedAgents: [makeAgent('fast-agent')],
      input,
      domainHint: 'health',
      timeoutMs: 5000,
    })

    expect(result.round1Proposals[0]?.confidence).toBe(0.8)
    expect(result.round1Proposals[0]?.summary).toBe('ok')
  })

  it('handles mixed: one agent times out, one succeeds', async () => {
    const SLOW_DELAY = 200
    const FAST_TIMEOUT = 50

    const llm = {
      complete: vi.fn().mockImplementation(async ({ system }: { system: string; user: string }) => {
        if (system === 'system-slow') {
          return new Promise<typeof goodResponse>((resolve) =>
            setTimeout(() => resolve(goodResponse), SLOW_DELAY),
          )
        }
        return goodResponse
      }),
    }

    const result = await executeAgentRounds({
      llm,
      selectedAgents: [makeAgent('slow'), makeAgent('fast')],
      input,
      domainHint: 'health',
      timeoutMs: FAST_TIMEOUT,
    })

    expect(result.round1Proposals).toHaveLength(2)
    // Slow agent times out → confidence 0; fast agent succeeds → confidence > 0
    const slowProposal = result.round1Proposals.find((p) => p.agentId === 'slow')
    const fastProposal = result.round1Proposals.find((p) => p.agentId === 'fast')
    expect(slowProposal?.confidence).toBe(0)
    expect(fastProposal?.confidence).toBeGreaterThan(0)
  }, 2000)
})
