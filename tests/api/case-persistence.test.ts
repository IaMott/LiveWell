import { describe, expect, it } from 'vitest'
import { fromStoredCaseState, readCanonicalCaseRuntimeState } from '@/lib/ai/case/persistence'

function buildCanonicalSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    conversationId: 'conv-canonical-1',
    activeDomains: ['health'],
    domainPanels: [
      {
        domain: 'health',
        selectedAgentId: 'fisiatra',
        candidateAgentIds: ['fisiatra', 'mmg'],
        status: 'active',
        priorityScore: 10,
        lastReasoningAt: null,
        pendingNeeds: [],
      },
    ],
    leadDomain: 'health',
    speakerPolicy: 'lead',
    conversationFocus: {
      activeProblems: ['dolore lombare'],
      activeGoals: ['ridurre il dolore'],
      activeConstraints: [],
      summary: 'focus clinico',
    },
    coordinationState: {
      crossDomainConflicts: [],
      dependencies: [],
      needsReview: false,
    },
    sharedOpenQuestions: [],
    domainOpenQuestions: {},
    updatedAt: '2026-03-26T20:00:00.000Z',
    ...overrides,
  }
}

describe('case persistence canonical-first read path', () => {
  it('returns canonical runtime state when stateSnapshot is valid', () => {
    const restored = readCanonicalCaseRuntimeState({
      conversationId: 'conv-canonical-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'owner_active',
      stateSnapshot: buildCanonicalSnapshot(),
    })

    expect(restored).toMatchObject({
      conversationId: 'conv-canonical-1',
      leadDomain: 'health',
      activeDomains: ['health'],
    })
    expect(restored?.domainPanels[0]?.selectedAgentId).toBe('fisiatra')
    expect(restored?.conversationFocus.summary).toBe('focus clinico')
  })

  it('stateSnapshot wins over conflicting legacy fields', () => {
    const restored = readCanonicalCaseRuntimeState({
      conversationId: 'conv-canonical-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'consult_active_takeover',
      stateSnapshot: buildCanonicalSnapshot({
        leadDomain: 'nutrition',
        activeDomains: ['nutrition'],
        domainPanels: [
          {
            domain: 'nutrition',
            selectedAgentId: 'dietista',
            candidateAgentIds: ['dietista'],
            status: 'active',
            priorityScore: 8,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
      }),
      leadDomain: 'health',
      activeDomains: ['health'],
    })

    expect(restored?.leadDomain).toBe('nutrition')
    expect(restored?.activeDomains).toEqual(['nutrition'])
    expect(restored?.domainPanels[0]?.selectedAgentId).toBe('dietista')
  })

  it('falls back to legacy only when stateSnapshot is missing', () => {
    const restored = readCanonicalCaseRuntimeState({
      conversationId: 'conv-legacy-1',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover',
    })

    expect(restored).toMatchObject({
      conversationId: 'conv-legacy-1',
      speakerPolicy: 'explicit_agent',
    })
    expect(restored?.domainPanels[0]?.selectedAgentId).toBe('fisioterapista')
  })

  it('returns null when neither valid canonical nor valid legacy exists', () => {
    expect(readCanonicalCaseRuntimeState({ stateSnapshot: { schemaVersion: 1 } })).toBeNull()
    expect(readCanonicalCaseRuntimeState(null)).toBeNull()
  })

  it('fromStoredCaseState still returns CaseState for legacy consumers', () => {
    const restored = fromStoredCaseState({
      conversationId: 'conv-legacy-2',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover',
    })

    expect(restored).toMatchObject({
      conversationId: 'conv-legacy-2',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover',
    })
  })

  it('fromStoredCaseState uses canonical-first behavior indirectly', () => {
    const restored = fromStoredCaseState({
      conversationId: 'conv-canonical-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'owner_active',
      stateSnapshot: buildCanonicalSnapshot({
        domainPanels: [
          {
            domain: 'health',
            selectedAgentId: 'fisiatra',
            candidateAgentIds: ['fisiatra'],
            status: 'active',
            priorityScore: 10,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
      }),
    })

    expect(restored?.ownerAgentId).toBe('legacy-owner')
    expect(restored?.activeSpeakerAgentId).toBe('fisiatra')
    expect(restored?.leadDomain).toBe('health')
  })
})
