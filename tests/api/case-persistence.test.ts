import { describe, expect, it } from 'vitest'
import { fromStoredCaseState } from '@/lib/ai/case/persistence'

describe('case persistence canonical-first read path', () => {
  it('prioritizes stateSnapshot over conflicting legacy fields', () => {
    const restored = fromStoredCaseState({
      conversationId: 'conv-canonical-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'owner_active',
      stateSnapshot: {
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
      },
    })

    expect(restored).toBeTruthy()
    expect(restored?.activeSpeakerAgentId).toBe('fisiatra')
    expect(restored?.ownerAgentId).toBe('legacy-owner')
    expect(restored?.leadDomain).toBe('health')
    expect(restored?.domainPanels?.[0]?.selectedAgentId).toBe('fisiatra')
    expect(restored?.conversationFocus?.summary).toBe('focus clinico')
  })

  it('falls back to legacy fields when stateSnapshot is absent', () => {
    const restored = fromStoredCaseState({
      conversationId: 'conv-legacy-1',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover',
    })

    expect(restored).toBeTruthy()
    expect(restored?.ownerAgentId).toBe('dietista')
    expect(restored?.activeSpeakerAgentId).toBe('fisioterapista')
    expect(restored?.protocolState).toBe('consult_active_takeover')
  })
})
