import { describe, expect, it, vi } from 'vitest'
import { executeAgent, type LlmClient } from '@/lib/ai/orchestrator/agentExecution'
import type { AgentInput, AgentProfile } from '@/lib/ai/types'

const agent: AgentProfile = {
  id: 'mmg',
  displayName: 'MMG',
  domainTags: ['health', 'general'],
  systemPrompt: 'Sei un medico.',
  toolsAllowed: ['user.setAttribute'],
  decisionStyle: 'team-led',
}

const input: AgentInput = {
  requestId: 'req-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  message: 'Sono allergico alle arachidi',
  contextPack: {
    user: { id: 'user-1', role: 'USER', profile: {}, attributes: {} },
    history: { recentMessages: [], recentArtifacts: [] },
    trackers: {},
    notifications: { unreadCount: 0 },
    ui: { moodScore: 50 },
  },
}

describe('agent execution boundary', () => {
  it('returns a normalized proposal on valid JSON output', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          domain: 'health',
          summary: 'summary',
          reasoning: 'reasoning',
          questions: ['q1'],
          recommendations: [],
          toolCalls: [{ id: 'tc1', name: 'user.updateProfile', args: { fields: { weight: 80 } } }],
          confidence: 0.9,
          citations: [{ title: 'source' }],
          flags: { needsMoreInfo: true },
        }),
      }),
    }

    const proposal = await executeAgent({ llm, agent, input, domainHint: 'health' })

    expect(llm.complete).toHaveBeenCalledTimes(1)
    expect(proposal).toMatchObject({
      agentId: 'mmg',
      domain: 'health',
      summary: 'summary',
      reasoning: 'reasoning',
      questions: ['q1'],
      confidence: 0.9,
      citations: [{ title: 'source' }],
      flags: { needsMoreInfo: true },
    })
  })

  it('uses fallback tool calls when the LLM omits them', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          domain: 'nutrition',
          summary: 'summary',
          reasoning: 'reasoning',
          questions: [],
          recommendations: [],
        }),
      }),
    }

    const proposal = await executeAgent({ llm, agent, input, domainHint: 'nutrition' })

    expect(proposal.toolCalls).toEqual([
      expect.objectContaining({
        name: 'user.setAttribute',
        args: expect.objectContaining({
          domain: 'nutrition',
          key: 'allergy',
        }),
      }),
    ])
    expect(
      String(
        proposal.toolCalls?.[0]?.args && (proposal.toolCalls[0].args as { value?: unknown }).value,
      ),
    ).toContain('arachidi')
  })

  it('returns a fallback proposal on non-JSON output', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue({
        text: 'Risposta libera non JSON',
      }),
    }

    const proposal = await executeAgent({ llm, agent, input, domainHint: 'health' })

    expect(proposal).toMatchObject({
      agentId: 'mmg',
      domain: 'health',
      summary: 'Risposta libera non JSON',
      reasoning: 'Risposta libera non JSON',
      confidence: 0.4,
    })
    expect(Array.isArray(proposal.toolCalls)).toBe(true)
  })

  it('accepts peerInsights without leaking orchestration concerns into the output contract', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          domain: 'health',
          summary: 'summary',
          reasoning: 'reasoning',
          questions: [],
          recommendations: [],
        }),
      }),
    }

    const proposal = await executeAgent({
      llm,
      agent,
      input,
      domainHint: 'health',
      peerInsights: '- dietista: summary',
    })

    expect(proposal.agentId).toBe('mmg')
    expect(proposal.domain).toBe('health')
    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Sei un medico.',
        user: expect.stringContaining('PEER REVIEW (round 2):'),
      }),
    )
  })
})
