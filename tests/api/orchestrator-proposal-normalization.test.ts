import { describe, expect, it } from 'vitest'
import { normalizeAgentProposal } from '@/lib/ai/orchestrator/proposalNormalization'
import type { ToolCall } from '@/lib/ai/types'

const fallbackToolCalls: ToolCall[] = [
  {
    id: 'tc-fallback',
    name: 'user.setAttribute',
    args: { domain: 'health', key: 'weight', value: 80, unit: 'kg' },
  },
]

describe('orchestrator proposal normalization', () => {
  it('parses valid JSON output and preserves normalized optional fields', () => {
    const proposal = normalizeAgentProposal({
      text: JSON.stringify({
        domain: 'health',
        summary: 'summary',
        reasoning: 'reasoning',
        questions: ['q1', 'q2'],
        recommendations: [{ title: 'rec', steps: ['a'], rationale: 'why' }],
        toolCalls: [{ id: 'tc1', name: 'user.updateProfile', args: { fields: { weight: 80 } } }],
        confidence: 0.9,
        citations: [{ title: 'source' }],
        flags: { needsMoreInfo: true },
      }),
      agentId: 'mmg',
      domainHint: 'general',
      fallbackToolCalls,
    })

    expect(proposal).toMatchObject({
      agentId: 'mmg',
      domain: 'health',
      summary: 'summary',
      reasoning: 'reasoning',
      questions: ['q1', 'q2'],
      confidence: 0.9,
      citations: [{ title: 'source' }],
      flags: { needsMoreInfo: true },
    })
    expect(proposal.toolCalls).toEqual([
      { id: 'tc1', name: 'user.updateProfile', args: { fields: { weight: 80 } } },
    ])
  })

  it('uses fallback tool calls when JSON output omits toolCalls', () => {
    const proposal = normalizeAgentProposal({
      text: JSON.stringify({
        domain: 'health',
        summary: 'summary',
        reasoning: 'reasoning',
        questions: [],
        recommendations: [],
      }),
      agentId: 'mmg',
      domainHint: 'health',
      fallbackToolCalls,
    })

    expect(proposal.toolCalls).toEqual(fallbackToolCalls)
    expect(proposal.domain).toBe('health')
    expect(proposal.confidence).toBe(0.6)
  })

  it('builds a fallback proposal when output is not valid JSON', () => {
    const proposal = normalizeAgentProposal({
      text: 'Risposta libera non JSON',
      agentId: 'mmg',
      domainHint: 'health',
      fallbackToolCalls,
    })

    expect(proposal).toMatchObject({
      agentId: 'mmg',
      domain: 'health',
      summary: 'Risposta libera non JSON',
      reasoning: 'Risposta libera non JSON',
      questions: [],
      recommendations: [],
      toolCalls: fallbackToolCalls,
      confidence: 0.4,
    })
  })
})
