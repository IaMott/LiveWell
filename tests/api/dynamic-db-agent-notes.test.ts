import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createToolExecutor } from '@/lib/tools/toolExecutor'
import { realToolHandlers } from '@/lib/tools/handlers'

const { mockUserAttributeCreate } = vi.hoisted(() => ({
  mockUserAttributeCreate: vi.fn(async () => ({ id: 'attr-1' })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userAttribute: {
      create: mockUserAttributeCreate,
    },
  },
}))

vi.mock('@/lib/db', () => ({
  updateUserProfile: vi.fn(),
  setGeoPreference: vi.fn(),
  upsertCoarseLocation: vi.fn(),
  clearCoarseLocation: vi.fn(),
}))

function makeExecutor() {
  return createToolExecutor({
    handlers: realToolHandlers,
    writeAuditLog: vi.fn(async () => undefined),
  })
}

function makeCtx() {
  return {
    requestId: 'req-dynamic-notes',
    conversationId: 'conv-dynamic-notes',
    actor: { userId: 'user-1', role: 'USER' as const, ownerModeEnabled: false },
    source: 'assistant' as const,
    confirmedByUser: false,
  }
}

describe('dynamic DB agent notes defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds default notes for health.updateMedications', async () => {
    const executor = makeExecutor()
    const result = await executor.executeToolCall(
      {
        id: 'tc-meds',
        name: 'health.updateMedications',
        args: { medications: [{ name: 'Metformina', dosage: '500mg' }] },
      },
      makeCtx(),
    )

    expect(result.ok).toBe(true)
    expect(mockUserAttributeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'medications',
          notes: expect.any(String),
        }),
      }),
    )
  })

  it('adds default notes for nutrition.setCalorieGoal', async () => {
    const executor = makeExecutor()
    const result = await executor.executeToolCall(
      {
        id: 'tc-kcal',
        name: 'nutrition.setCalorieGoal',
        args: { targetKcal: 2100 },
      },
      makeCtx(),
    )

    expect(result.ok).toBe(true)
    expect(mockUserAttributeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'caloricGoal',
          notes: expect.any(String),
        }),
      }),
    )
  })

  it('adds default notes for training.logInjury and training.updatePlan', async () => {
    const executor = makeExecutor()

    await executor.executeToolCall(
      {
        id: 'tc-injury',
        name: 'training.logInjury',
        args: { location: 'ginocchio destro', severity: 3 },
      },
      makeCtx(),
    )
    await executor.executeToolCall(
      {
        id: 'tc-plan',
        name: 'training.updatePlan',
        args: { sessions: [{ day: 'Lunedi', type: 'forza', durationMin: 45 }] },
      },
      makeCtx(),
    )

    expect(mockUserAttributeCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'injuries',
          notes: expect.any(String),
        }),
      }),
    )
    expect(mockUserAttributeCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'trainingPlan',
          notes: expect.any(String),
        }),
      }),
    )
  })

  it('adds default notes for nutrition.logWater', async () => {
    const executor = makeExecutor()
    const result = await executor.executeToolCall(
      {
        id: 'tc-water',
        name: 'nutrition.logWater',
        args: { amountMl: 750 },
      },
      makeCtx(),
    )

    expect(result.ok).toBe(true)
    expect(mockUserAttributeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'waterIntake',
          notes: expect.stringContaining('750'),
        }),
      }),
    )
  })
})
