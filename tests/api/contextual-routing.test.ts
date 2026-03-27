import { describe, expect, it } from 'vitest'
import { resolveContextualRouting } from '@/lib/ai/orchestrator/contextualRouting'
import type { AgentInput, ContextPack, ToolCall } from '@/lib/ai/types'

function makeContextPack(overrides?: Partial<ContextPack>): ContextPack {
  return {
    user: {
      id: 'u1',
      role: 'OWNER',
      profile: {},
      attributes: {},
      attributeHistory: {},
      medicalRecord: undefined,
    },
    history: {
      recentMessages: [],
      crossConversationMessages: [],
      agentWorkspaces: [],
      toolExecutionTrace: [],
      recentArtifacts: [],
      recentConversationSummaries: [],
    },
    trackers: {},
    notifications: { unreadCount: 0 },
    ui: { moodScore: 50, sectionScores: {} },
    ...overrides,
  }
}

function makeInput(overrides?: Partial<AgentInput>): AgentInput {
  return {
    requestId: 'req-1',
    userId: 'u1',
    conversationId: 'conv-1',
    message: 'continuiamo pure',
    contextPack: makeContextPack(),
    ...overrides,
  }
}

describe('resolveContextualRouting continuity sources', () => {
  it('prefers snapshot_context over conflicting heuristic fallback on short continuation turns', () => {
    const input = makeInput({
      message: 'continuiamo pure',
      caseStateSnapshot: {
        schemaVersion: 1,
        conversationId: 'conv-1',
        activeDomains: ['health', 'training'],
        domainPanels: [
          {
            domain: 'health',
            selectedAgentId: 'medico',
            candidateAgentIds: ['medico'],
            status: 'active',
            priorityScore: 10,
            lastReasoningAt: null,
            pendingNeeds: ['valutare la spalla'],
          },
          {
            domain: 'training',
            selectedAgentId: 'fisioterapista',
            candidateAgentIds: ['fisioterapista'],
            status: 'monitoring',
            priorityScore: 7,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
        leadDomain: 'health',
        speakerPolicy: 'lead',
        conversationFocus: {
          activeProblems: ['dolore spalla'],
          activeGoals: ['allenarmi in sicurezza'],
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
        updatedAt: '2026-03-27T22:16:00.000Z',
      },
    })

    const resolution = resolveContextualRouting({
      input,
      heuristicDetectedDomain: 'nutrition',
      heuristicAllDomains: ['nutrition'],
      llmExtractionCalls: [] satisfies ToolCall[],
      llmRouting: null,
    })

    expect(resolution).toMatchObject({
      detectedDomain: 'health',
      source: 'snapshot_context',
      preferredAgentIds: ['medico', 'fisioterapista'],
    })
    expect(resolution.allDomains).toEqual(['health', 'training'])
  })

  it('uses history_context when no snapshot is available but recent summaries keep the same domain alive', () => {
    const input = makeInput({
      message: 'ok continuiamo',
      contextPack: makeContextPack({
        history: {
          recentMessages: [],
          crossConversationMessages: [],
          agentWorkspaces: [],
          toolExecutionTrace: [],
          recentArtifacts: [],
          recentConversationSummaries: [
            {
              conversationId: 'prev-1',
              summary: 'percorso di mindfulness e stress lavorativo',
              domain: 'mindfulness',
              updatedAt: '2026-03-27T20:00:00.000Z',
            },
          ],
        },
        ui: {
          moodScore: 44,
          sectionScores: { mindfulness: 82, training: 18 },
        },
      }),
    })

    const resolution = resolveContextualRouting({
      input,
      heuristicDetectedDomain: 'training',
      heuristicAllDomains: ['training'],
      llmExtractionCalls: [] satisfies ToolCall[],
      llmRouting: null,
    })

    expect(resolution).toMatchObject({
      detectedDomain: 'mindfulness',
      source: 'history_context',
      preferredAgentIds: [],
    })
    expect(resolution.allDomains).toEqual(['mindfulness'])
  })
})
