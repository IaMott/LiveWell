import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetServerEnvForTests } from '@/lib/validators/env'

const prismaMock = {
  user: { findUnique: vi.fn(async () => null) },
  userProfile: { findUnique: vi.fn(async () => null) },
  message: { findMany: vi.fn(async () => []) },
  workoutSession: { findMany: vi.fn(async () => []) },
  meal: { findMany: vi.fn(async () => []) },
  mindfulnessEntry: { findMany: vi.fn(async () => []) },
  userAttribute: { findMany: vi.fn(async () => []) },
  caseState: {
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

// Mock @google/genai so the test doesn't make real API calls.
// authTokens.create returns a fake ephemeral token name.
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function MockGoogleGenAI() {
    return {
      authTokens: {
        create: vi.fn().mockResolvedValue({ name: 'auth_tokens/test-ephemeral-token-12345' }),
      },
      tokens: undefined,
    }
  }),
}))

describe('/api/live-token security baseline', () => {
  const oldEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...oldEnv }
    process.env.NODE_ENV = 'test'
    process.env.GEMINI_API_KEY = 'test-secret-key'
    process.env.LIVE_MODEL = 'gemini-2.0-flash-live-001'
    prismaMock.caseState.findUnique.mockResolvedValue(null)
    prismaMock.caseState.findFirst.mockResolvedValue(null)
    resetServerEnvForTests()
  })

  it('returns 401 without authentication header', async () => {
    const { POST } = await import('@/app/api/live-token/route')

    const req = new Request('http://localhost/api/live-token', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns ephemeral token to authenticated users (not the raw API key)', async () => {
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
    expect(res.status).toBe(200)

    const body = await res.json()

    // Must return a short-lived ephemeral token, not the full API key
    expect(body.token).toBeTypeOf('string')
    expect(body.token).toContain('auth_tokens/')
    expect(body.model).toBe('gemini-2.0-flash-live-001')

    // GEMINI_API_KEY must NOT appear in the response
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('test-secret-key')
    // apiKey field must not be present
    expect(body.apiKey).toBeUndefined()
  })
})
