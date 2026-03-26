import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createToolExecutor } from '@/lib/tools/toolExecutor'
import { realToolHandlers } from '@/lib/tools/handlers'

const { mockUserAttributeCreate, mockUserAttributeFindFirst, mockRecommendationArtifactCreate } =
  vi.hoisted(() => ({
    mockUserAttributeCreate: vi.fn(async () => ({ id: 'attr-1' })),
    mockUserAttributeFindFirst: vi.fn(async () => null),
    mockRecommendationArtifactCreate: vi.fn(async () => ({ id: 'artifact-1' })),
  }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userAttribute: {
      findFirst: mockUserAttributeFindFirst,
      create: mockUserAttributeCreate,
    },
    recommendationArtifact: {
      create: mockRecommendationArtifactCreate,
    },
  },
}))

vi.mock('@/lib/db', () => ({
  updateUserProfile: vi.fn(),
  setGeoPreference: vi.fn(),
  upsertCoarseLocation: vi.fn(),
  clearCoarseLocation: vi.fn(),
}))

describe('artifacts.saveRecommendation dynamic-db companion record', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserAttributeFindFirst.mockResolvedValue(null)
  })

  it('creates the recommendation artifact and a dynamic-db reference with notes', async () => {
    const executor = createToolExecutor({
      handlers: realToolHandlers,
      writeAuditLog: vi.fn(async () => undefined),
    })

    const result = await executor.executeToolCall(
      {
        id: 'tc-artifact',
        name: 'artifacts.saveRecommendation',
        args: {
          type: 'nutrition',
          title: 'Piano settimanale',
          contentMarkdown: 'contenuto',
          notes: 'Valutazione dietistica: piano coerente con il target iniziale.',
        },
      },
      {
        requestId: 'req-artifact',
        conversationId: 'conv-artifact',
        actor: { userId: 'user-1', role: 'USER', ownerModeEnabled: false },
        source: 'assistant',
        confirmedByUser: false,
      },
    )

    expect(result.ok).toBe(true)
    expect(mockRecommendationArtifactCreate).toHaveBeenCalledTimes(1)
    expect(mockUserAttributeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: 'general',
          key: 'generated_artifact',
          notes: 'Valutazione dietistica: piano coerente con il target iniziale.',
        }),
      }),
    )
  })
})
