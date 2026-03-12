import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetServerEnvForTests } from '@/lib/validators/env'

const logApiErrorEventMock = vi.fn(async () => undefined)

vi.mock('@/lib/monitoring/apiErrorEvents', () => ({
  logApiErrorEvent: logApiErrorEventMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => {
        throw new Error('db down')
      }),
    },
    userProfile: { findUnique: vi.fn(async () => null) },
    message: { findMany: vi.fn(async () => []) },
    workoutSession: { findMany: vi.fn(async () => []) },
    meal: { findMany: vi.fn(async () => []) },
    mindfulnessEntry: { findMany: vi.fn(async () => []) },
    userAttribute: { findMany: vi.fn(async () => []) },
  },
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    authTokens: {
      create: vi.fn().mockResolvedValue({ name: 'auth_tokens/test-live-fallback-token' }),
    },
    tokens: undefined,
  })),
}))

describe('/api/live-token fallback observability', () => {
  const oldEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...oldEnv }
    process.env.NODE_ENV = 'test'
    process.env.GEMINI_API_KEY = 'test-secret-key'
    process.env.LIVE_MODEL = 'gemini-2.0-flash-live-001'
    resetServerEnvForTests()
  })

  it('logs structured fallback when system instruction build fails', async () => {
    const { POST } = await import('@/app/api/live-token/route')

    const req = new Request('http://localhost/api/live-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u1',
      },
      body: JSON.stringify({ conversationId: 'c1' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.systemInstruction).toContain('Sei un assistente AI per la salute')

    expect(
      logApiErrorEventMock.mock.calls.some(
        (c) =>
          c[0]?.errorCode === 'FALLBACK_SYSTEM_INSTRUCTION' &&
          c[0]?.metadata?.fallbackPhase === 'SYSTEM_INSTRUCTION_BUILD',
      ),
    ).toBe(true)
  })
})
