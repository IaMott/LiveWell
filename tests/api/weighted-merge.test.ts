/**
 * Tests for weighted merge / conflict resolution logic.
 */

import { describe, it, expect } from 'vitest'
import {
  rankByWeight,
  mergeToolCallsWeighted,
  detectWeightedConflicts,
  aggregateConfidence,
} from '@/lib/ai/consensus/weightedMerge'
import type { AgentProposal } from '@/lib/ai/types'

function makeProposal(override: Partial<AgentProposal> = {}): AgentProposal {
  return {
    agentId: 'test-agent',
    domain: 'general',
    summary: 'Test summary',
    reasoning: '',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0.8,
    ...override,
  }
}

describe('rankByWeight', () => {
  it('sorts by confidence descending', () => {
    const proposals = [
      makeProposal({ agentId: 'low', confidence: 0.3 }),
      makeProposal({ agentId: 'high', confidence: 0.9 }),
      makeProposal({ agentId: 'mid', confidence: 0.6 }),
    ]
    const ranked = rankByWeight(proposals)
    expect(ranked.map((p) => p.agentId)).toEqual(['high', 'mid', 'low'])
  })

  it('filters out confidence=0 (timeout/fallback)', () => {
    const proposals = [
      makeProposal({ agentId: 'active', confidence: 0.7 }),
      makeProposal({ agentId: 'timeout', confidence: 0 }),
    ]
    const ranked = rankByWeight(proposals)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].agentId).toBe('active')
  })

  it('returns empty array when all are confidence=0', () => {
    const proposals = [makeProposal({ confidence: 0 }), makeProposal({ confidence: 0 })]
    expect(rankByWeight(proposals)).toHaveLength(0)
  })
})

describe('mergeToolCallsWeighted', () => {
  it('prefers tool calls from higher confidence proposals', () => {
    const tcA = { id: 'tc1', name: 'health.addMetric', args: { type: 'weight', value: 75 } }
    const tcB = { id: 'tc2', name: 'nutrition.logMeal', args: { mealType: 'lunch', items: [] } }
    const proposals = [
      makeProposal({ agentId: 'low', confidence: 0.4, toolCalls: [tcB] }),
      makeProposal({ agentId: 'high', confidence: 0.9, toolCalls: [tcA] }),
    ]
    const calls = mergeToolCallsWeighted(proposals)
    // tcA (from high confidence) comes first
    expect(calls[0].name).toBe('health.addMetric')
  })

  it('deduplicates identical tool calls', () => {
    const tc = { id: 'tc1', name: 'health.addMetric', args: { type: 'weight', value: 75 } }
    const proposals = [
      makeProposal({ confidence: 0.9, toolCalls: [tc] }),
      makeProposal({ confidence: 0.7, toolCalls: [{ ...tc, id: 'tc2' }] }),
    ]
    const calls = mergeToolCallsWeighted(proposals)
    expect(calls).toHaveLength(1)
  })

  it('excludes tool calls from proposals below MIN_CONFIDENCE (0.3)', () => {
    const tc = { id: 'tc1', name: 'health.addMetric', args: {} }
    const proposals = [makeProposal({ confidence: 0.2, toolCalls: [tc] })]
    const calls = mergeToolCallsWeighted(proposals)
    expect(calls).toHaveLength(0)
  })
})

describe('aggregateConfidence', () => {
  it('returns 0 for empty proposals', () => {
    expect(aggregateConfidence([])).toBe(0)
  })

  it('returns 0 when all confidence is 0', () => {
    expect(aggregateConfidence([makeProposal({ confidence: 0 })])).toBe(0)
  })

  it('returns single value for single proposal', () => {
    const result = aggregateConfidence([makeProposal({ confidence: 0.8 })])
    expect(result).toBeCloseTo(0.8, 3)
  })

  it('weights higher confidence proposals more', () => {
    const result = aggregateConfidence([
      makeProposal({ confidence: 0.9 }),
      makeProposal({ confidence: 0.1 }),
    ])
    // Should be >0.5 (weighted toward the 0.9)
    expect(result).toBeGreaterThan(0.5)
  })
})

describe('detectWeightedConflicts', () => {
  it('detects opposing recommendations in same domain', () => {
    const proposals = [
      makeProposal({
        agentId: 'a1',
        domain: 'nutrition',
        confidence: 0.8,
        summary: 'Ti consiglio di aumenta le proteine nella dieta',
        reasoning: 'consiglio di incrementare',
      }),
      makeProposal({
        agentId: 'a2',
        domain: 'nutrition',
        confidence: 0.7,
        summary: 'Ti sconsiglio di cambiare dieta',
        reasoning: 'sconsiglio la modifica',
      }),
    ]
    const conflicts = detectWeightedConflicts(proposals)
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it('does NOT flag proposals in different domains', () => {
    const proposals = [
      makeProposal({
        agentId: 'a1',
        domain: 'nutrition',
        confidence: 0.8,
        summary: 'consiglio proteine',
      }),
      makeProposal({
        agentId: 'a2',
        domain: 'training',
        confidence: 0.7,
        summary: 'sconsiglio corsa',
      }),
    ]
    const conflicts = detectWeightedConflicts(proposals)
    expect(conflicts).toHaveLength(0)
  })

  it('ignores low confidence proposals (< 0.5)', () => {
    const proposals = [
      makeProposal({
        agentId: 'a1',
        domain: 'nutrition',
        confidence: 0.9,
        summary: 'consiglio questo',
      }),
      makeProposal({
        agentId: 'a2',
        domain: 'nutrition',
        confidence: 0.3,
        summary: 'sconsiglio questo',
      }),
    ]
    const conflicts = detectWeightedConflicts(proposals)
    expect(conflicts).toHaveLength(0)
  })
})
