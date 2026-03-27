/**
 * orchestrator-routing-phase1.test.ts
 *
 * Tests the PRODUCTION routing path: resolveRoutingCandidates() from routing.ts.
 * This is the function actually called by orchestrate() on every chat request.
 *
 * Replaced legacy test that covered routingLegacy.ts (dead code, now deleted).
 */

import { describe, expect, it } from 'vitest'
import type { AgentProfile } from '@/lib/ai/types'
import { resolveRoutingCandidates } from '@/lib/ai/orchestrator/routing'

// ─── Minimal team fixture ────────────────────────────────────────────────────

function agent(
  id: string,
  displayName: string,
  domainTags: AgentProfile['domainTags'],
): AgentProfile {
  return {
    id,
    displayName,
    domainTags,
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  }
}

const team: AgentProfile[] = [
  agent('mmg', 'Medico di Base', ['health']),
  agent('fisioterapista', 'Fisioterapista', ['training', 'health']),
  agent('fisiatra', 'Fisiatra', ['health']),
  agent('medico-dello-sport', 'Medico dello Sport', ['training', 'health']),
  agent('dietista', 'Dietista', ['nutrition']),
  agent('endocrinologo', 'Endocrinologo', ['health']),
  agent('sleep-coach', 'Sleep Coach', ['health', 'mindfulness']),
  agent('psicologo', 'Psicologo', ['mindfulness']),
  agent('mental-coach', 'Mental Coach', ['mindfulness', 'training']),
  agent('chinesologo', 'Chinesologo', ['training']),
  agent('persona-trainer', 'Personal Trainer', ['training']),
]

// ─── Specialist request (explicit) ───────────────────────────────────────────

describe('resolveRoutingCandidates — production path', () => {
  it('selects fisioterapista first when user requests it explicitly', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'voglio parlare con il fisioterapista',
      detectedDomain: 'health',
      allDomains: ['health'],
      currentSpeakerId: 'fisioterapista',
    })

    expect(selectedAgents[0]?.id).toBe('fisioterapista')
    expect(selectedAgents.length).toBeLessThanOrEqual(3)
  })

  it('caps collaboration to 3 when currentSpeakerId is set', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'ho mal di schiena e vorrei capire come allenarmi',
      detectedDomain: 'health',
      allDomains: ['health', 'training'],
      currentSpeakerId: 'fisioterapista',
    })

    expect(selectedAgents[0]?.id).toBe('fisioterapista')
    expect(selectedAgents.length).toBeLessThanOrEqual(3)
  })

  // ─── Domain-based selection (no active speaker) ─────────────────────────

  it('selects nutrition agents for a nutrition query', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'voglio un piano alimentare per dimagrire',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
    })

    expect(selectedAgents.some((a) => a.id === 'dietista')).toBe(true)
  })

  it('uses preferredAgentIds as primary ranking signal for follow-up turns', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'continuiamo pure',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      preferredAgentIds: ['dietista'],
    })

    expect(selectedAgents[0]?.id).toBe('dietista')
  })

  it('selects mindfulness agents for a stress/sleep query', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'sono molto stressato e dormo male',
      detectedDomain: 'mindfulness',
      allDomains: ['mindfulness'],
    })

    const ids = selectedAgents.map((a) => a.id)
    expect(ids.some((id) => ['psicologo', 'mental-coach', 'sleep-coach'].includes(id))).toBe(true)
  })

  // ─── Symptom cluster routing ─────────────────────────────────────────────

  it('includes sleep-coach when sleep-metabolism cluster fires', () => {
    // Message triggers Sleep-metabolism cluster:
    // group1: "dormo male" (sonno), group2: "stanco" (stanc), group3: "peso" (peso)
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'dormo male, sono sempre stanco e non perdo peso',
      detectedDomain: 'health',
      allDomains: ['health', 'mindfulness'],
    })

    const ids = selectedAgents.map((a) => a.id)
    expect(ids).toContain('sleep-coach')
  })

  it('includes endocrinologo when sleep-metabolism cluster fires', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'dormo male, sono sempre stanco e non perdo peso',
      detectedDomain: 'health',
      allDomains: ['health'],
    })

    const ids = selectedAgents.map((a) => a.id)
    expect(ids).toContain('endocrinologo')
  })

  // ─── Chinesologo scoring ────────────────────────────────────────────────

  it('includes chinesologo for posture/movement queries', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team,
      message: 'ho problemi di postura e voglio migliorare il mio schema motorio',
      detectedDomain: 'training',
      allDomains: ['training'],
    })

    const ids = selectedAgents.map((a) => a.id)
    expect(ids).toContain('chinesologo')
  })

  // ─── Decision trace ─────────────────────────────────────────────────────

  it('returns a non-empty decisionTrace for every routing call', () => {
    const { decisionTrace } = resolveRoutingCandidates({
      team,
      message: 'come posso migliorare il mio allenamento?',
      detectedDomain: 'training',
      allDomains: ['training'],
    })

    expect(decisionTrace.length).toBeGreaterThan(0)
  })
})
