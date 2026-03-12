import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createToolExecutor } from '@/lib/tools/toolExecutor'
import { realToolHandlers } from '@/lib/tools/handlers'
import { buildContextPack, type DbClient } from '@/lib/ai/context/contextPackBuilder'

type AttrRow = {
  id: string
  userId: string
  domain: string
  key: string
  value: unknown
  unit: string | null
  source: string
  conversationId: string | null
  recordedAt: Date
  validUntil: Date | null
  notes: string | null
  createdAt: Date
}

const memAttrs: AttrRow[] = []

const { mockUpdateUserProfile } = vi.hoisted(() => ({
  mockUpdateUserProfile: vi.fn(async () => ({ id: 'profile-1' })),
}))

vi.mock('@/lib/db', () => ({
  updateUserProfile: mockUpdateUserProfile,
  setGeoPreference: vi.fn(),
  upsertCoarseLocation: vi.fn(),
  clearCoarseLocation: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userAttribute: {
      findFirst: vi.fn(
        async (args: {
          where: { userId: string; conversationId: string | null; domain: string; key: string }
        }) => {
          const found = memAttrs
            .filter(
              (r) =>
                r.userId === args.where.userId &&
                r.conversationId === args.where.conversationId &&
                r.domain === args.where.domain &&
                r.key === args.where.key,
            )
            .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0]
          return found ? { id: found.id, value: found.value } : null
        },
      ),
      create: vi.fn(async (args: { data: Omit<AttrRow, 'id' | 'createdAt'> }) => {
        const row: AttrRow = {
          id: `attr-${memAttrs.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        }
        memAttrs.push(row)
        return { id: row.id }
      }),
    },
  },
}))

function makeDb(userId: string, conversationId: string): DbClient {
  return {
    user: { findUnique: async () => ({ id: userId, role: 'USER' }) },
    message: { findMany: async () => [] },
    recommendationArtifact: { findMany: async () => [] },
    notification: { count: async () => 0, findFirst: async () => null },
    userProfile: { findUnique: async () => ({}) },
    medicalInfo: { findUnique: async () => null },
    bodyMetricEntry: { findMany: async () => [] },
    meal: { findMany: async () => [] },
    workoutSession: { findMany: async () => [] },
    mindfulnessEntry: { findMany: async () => [] },
    fileAsset: { findMany: async () => [] },
    userAttribute: {
      findMany: async () =>
        memAttrs
          .filter((a) => a.userId === userId && a.conversationId === conversationId)
          .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
          .map((a) => ({
            domain: a.domain,
            key: a.key,
            value: a.value,
            unit: a.unit,
            recordedAt: a.recordedAt,
            notes: a.notes,
            source: a.source,
          })),
    },
  }
}

describe('e2e per-domain canonical write/read', () => {
  beforeEach(() => {
    memAttrs.length = 0
    mockUpdateUserProfile.mockClear()
  })

  it('writes canonical keys and reads them back from ContextPack', async () => {
    const executor = createToolExecutor({
      handlers: realToolHandlers,
      writeAuditLog: async () => undefined,
    })

    const actor = { userId: 'u-e2e', role: 'USER' as const, ownerModeEnabled: false }
    const baseCtx = {
      requestId: 'req-e2e',
      conversationId: 'conv-e2e',
      actor,
      source: 'assistant' as const,
      confirmedByUser: false,
    }

    await executor.executeToolCall(
      {
        id: 't1',
        name: 'user.setAttribute',
        args: {
          domain: 'health',
          key: 'medicalConditions.hypertension.status',
          value: 'diagnosed',
        },
      },
      baseCtx,
    )
    await executor.executeToolCall(
      {
        id: 't2',
        name: 'user.setAttribute',
        args: { domain: 'health', key: 'hypertension_diagnosis_year', value: 2022 },
      },
      baseCtx,
    )
    await executor.executeToolCall(
      {
        id: 't3',
        name: 'user.setAttribute',
        args: { domain: 'health', key: 'allergies', value: 'nocciole' },
      },
      baseCtx,
    )
    await executor.executeToolCall(
      {
        id: 't4',
        name: 'user.setAttribute',
        args: { domain: 'mindfulness', key: 'stress', value: 8 },
      },
      baseCtx,
    )
    await executor.executeToolCall(
      {
        id: 't5',
        name: 'user.setAttribute',
        args: { domain: 'training', key: 'weeklyTraining', value: 4 },
      },
      baseCtx,
    )
    await executor.executeToolCall(
      {
        id: 't6',
        name: 'user.setAttribute',
        args: { domain: 'general', key: 'obiettivo', value: 'lanciare un podcast entro settembre' },
      },
      baseCtx,
    )

    const pack = await buildContextPack({
      userId: 'u-e2e',
      conversationId: 'conv-e2e',
      db: makeDb('u-e2e', 'conv-e2e'),
    })

    expect(pack.user.attributes?.health?.hypertension?.value).toBe('diagnosed')
    expect(pack.user.attributes?.health?.hypertension_diagnosed_year?.value).toBe(2022)
    expect(pack.user.attributes?.nutrition?.allergy?.value).toBe('nocciole')
    expect(pack.user.attributes?.mindfulness?.stress_level?.value).toBe(8)
    expect(pack.user.attributes?.training?.training_frequency_per_week?.value).toBe(4)
    expect(pack.user.attributes?.general?.goal?.value).toContain('podcast')
  })
})
