import { describe, expect, it } from 'vitest'
import { buildContextPack, type DbClient } from '@/lib/ai/context/contextPackBuilder'

function makeDb(): DbClient {
  return {
    user: {
      findUnique: async () => ({ id: 'u1', role: 'USER' }),
    },
    message: {
      findMany: async (args) => {
        const where = (args as { where?: Record<string, unknown> }).where ?? {}
        if (Object.prototype.hasOwnProperty.call(where, 'conversationId')) {
          return [
            { role: 'user', content: 'msg current', createdAt: new Date('2026-03-10T10:00:00Z') },
          ]
        }
        return [
          { role: 'assistant', content: 'msg old', createdAt: new Date('2026-03-09T10:00:00Z') },
        ]
      },
    },
    recommendationArtifact: { findMany: async () => [] },
    notification: {
      count: async () => 0,
      findFirst: async () => null,
    },
    userProfile: { findUnique: async () => ({}) },
    medicalInfo: { findUnique: async () => null },
    bodyMetricEntry: { findMany: async () => [] },
    meal: { findMany: async () => [] },
    workoutSession: { findMany: async () => [] },
    mindfulnessEntry: { findMany: async () => [] },
    fileAsset: { findMany: async () => [] },
    userAttribute: {
      findMany: async () => [
        {
          domain: 'health',
          key: 'diagnosis',
          value: 'lombalgia',
          unit: null,
          recordedAt: new Date('2026-03-10T09:00:00Z'),
          notes: 'recente',
          source: 'agent',
        },
        {
          domain: 'health',
          key: 'diagnosis',
          value: 'vecchia',
          unit: null,
          recordedAt: new Date('2026-03-09T09:00:00Z'),
          notes: null,
          source: 'agent',
        },
      ],
    },
    agentWorkspace: {
      findMany: async () => [
        {
          agentId: 'fisioterapista',
          round1Proposal: { summary: 'Possibile lombalgia meccanica' },
          round2Proposal: { summary: 'Valutare irradiazione e trigger di movimento' },
          updatedAt: new Date('2026-03-10T10:05:00Z'),
        },
        {
          agentId: 'orchestratore-trace',
          round2Proposal: {
            summary: 'Tool execution trace',
            toolExecutionTrace: [
              {
                toolCallId: 'tc-1',
                name: 'user.setAttribute',
                ok: true,
              },
            ],
          },
          updatedAt: new Date('2026-03-10T10:06:00Z'),
        },
      ],
    },
  }
}

describe('buildContextPack', () => {
  it('includes cross-conversation messages and latest attributes', async () => {
    const pack = await buildContextPack({ userId: 'u1', conversationId: 'c1', db: makeDb() })

    expect(pack.history.recentMessages.length).toBe(1)
    expect(pack.history.crossConversationMessages?.length).toBe(1)
    expect(pack.user.attributes?.health?.diagnosis).toBeTruthy()
    expect(pack.user.attributes?.health?.diagnosis?.value).toBe('lombalgia')
    expect(pack.history.agentWorkspaces?.[0]?.agentId).toBe('fisioterapista')
    expect(pack.history.agentWorkspaces?.[0]?.round2Summary).toContain('Valutare irradiazione')
    expect(pack.history.toolExecutionTrace?.length).toBe(1)
    expect(pack.history.toolExecutionTrace?.[0]).toMatchObject({
      toolCallId: 'tc-1',
      name: 'user.setAttribute',
      ok: true,
    })
  })
})
