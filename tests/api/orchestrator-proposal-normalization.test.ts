import { describe, expect, it } from 'vitest'
import { normalizeAgentProposal } from '@/lib/ai/orchestrator/proposalNormalization'

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

  it('returns empty toolCalls when JSON output omits them — fallback is handled by toolCallPlan', () => {
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
    })

    expect(proposal.toolCalls).toEqual([])
    expect(proposal.domain).toBe('health')
    expect(proposal.confidence).toBe(0.6)
  })

  it('builds a fallback proposal with empty toolCalls when output is not valid JSON', () => {
    const proposal = normalizeAgentProposal({
      text: 'Risposta libera non JSON',
      agentId: 'mmg',
      domainHint: 'health',
    })

    expect(proposal).toMatchObject({
      agentId: 'mmg',
      domain: 'health',
      summary: 'Risposta libera non JSON',
      reasoning: 'Risposta libera non JSON',
      questions: [],
      recommendations: [],
      toolCalls: [],
      confidence: 0.4,
    })
  })
})
