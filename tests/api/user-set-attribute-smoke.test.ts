import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createToolExecutor } from '@/lib/tools/toolExecutor'
import { realToolHandlers } from '@/lib/tools/handlers'

const { mockUserAttributeCreate, mockUpdateUserProfile } = vi.hoisted(() => ({
  mockUserAttributeCreate: vi.fn(async () => ({ id: 'attr-1' })),
  mockUpdateUserProfile: vi.fn(async () => ({ id: 'profile-1' })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userAttribute: {
      create: mockUserAttributeCreate,
    },
  },
}))

vi.mock('@/lib/db', () => ({
  updateUserProfile: mockUpdateUserProfile,
  setGeoPreference: vi.fn(),
  upsertCoarseLocation: vi.fn(),
  clearCoarseLocation: vi.fn(),
}))

describe('smoke auth user.setAttribute (mock DB)', () => {
  beforeEach(() => {
    mockUserAttributeCreate.mockClear()
    mockUpdateUserProfile.mockClear()
  })

  it('executes as authenticated USER and persists attribute history', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({
      handlers: realToolHandlers,
      writeAuditLog,
    })

    const result = await executor.executeToolCall(
      {
        id: 'tc-1',
        name: 'user.setAttribute',
        args: {
          domain: 'personal',
          key: 'weight',
          value: 81.2,
          unit: 'kg',
          notes: 'misurato al mattino',
        },
      },
      {
        requestId: 'req-1',
        conversationId: 'conv-1',
        actor: { userId: 'user-auth-1', role: 'USER', ownerModeEnabled: false },
        source: 'assistant',
        confirmedByUser: false,
      },
    )

    expect(result.ok).toBe(true)
    expect(mockUserAttributeCreate).toHaveBeenCalledTimes(1)
    expect(mockUserAttributeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-auth-1',
          domain: 'personal',
          key: 'weight',
          value: 81.2,
          unit: 'kg',
          conversationId: 'conv-1',
          source: 'agent',
        }),
      }),
    )

    // personal.weight also syncs the legacy profile snapshot for compatibility.
    expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-auth-1', { weight: 81.2 })
    expect(writeAuditLog).toHaveBeenCalledTimes(1)
  })

  it('syncs personal.birthDate into UserProfile snapshot', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({
      handlers: realToolHandlers,
      writeAuditLog,
    })

    const result = await executor.executeToolCall(
      {
        id: 'tc-2',
        name: 'user.setAttribute',
        args: {
          domain: 'personal',
          key: 'birthDate',
          value: '1991-06-26',
        },
      },
      {
        requestId: 'req-2',
        conversationId: 'conv-2',
        actor: { userId: 'user-auth-2', role: 'USER', ownerModeEnabled: false },
        source: 'assistant',
        confirmedByUser: false,
      },
    )

    expect(result.ok).toBe(true)
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      'user-auth-2',
      expect.objectContaining({
        birthDate: expect.any(Date),
      }),
    )
  })

  it('syncs personal.gender into UserProfile snapshot', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({
      handlers: realToolHandlers,
      writeAuditLog,
    })

    const result = await executor.executeToolCall(
      {
        id: 'tc-3',
        name: 'user.setAttribute',
        args: {
          domain: 'personal',
          key: 'gender',
          value: 'M',
        },
      },
      {
        requestId: 'req-3',
        conversationId: 'conv-3',
        actor: { userId: 'user-auth-3', role: 'USER', ownerModeEnabled: false },
        source: 'assistant',
        confirmedByUser: false,
      },
    )

    expect(result.ok).toBe(true)
    expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-auth-3', { gender: 'M' })
  })
})
