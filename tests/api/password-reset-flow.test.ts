/**
 * End-to-end API tests for the forgot-password / reset-password flow.
 *
 * Verifies:
 *  - POST /api/auth/forgot-password returns 200 always (anti-enumeration)
 *  - POST /api/auth/forgot-password calls prisma.user.findUnique
 *  - POST /api/auth/reset-password with a valid JWT → 200 + prisma.user.update called
 *  - POST /api/auth/reset-password with an expired/invalid token → 400
 *  - POST /api/auth/reset-password with a token signed with wrong secret → 400
 *  - POST /api/auth/reset-password with password too short → 400
 *  - POST /api/auth/reset-password with no token → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'

// ── Prisma mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// ── Rate-limit mock (always ok) ──────────────────────────────────────────────
vi.mock('@/lib/security/httpGuards', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { prisma } from '@/lib/prisma'
import { POST as forgotPost } from '@/app/api/auth/forgot-password/route'
import { POST as resetPost } from '@/app/api/auth/reset-password/route'

// ── Helpers ──────────────────────────────────────────────────────────────────
const TEST_SECRET = 'test-secret-min-32-chars-padding-ok!!'

function makeRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function signToken(payload: Record<string, unknown>, secret = TEST_SECRET, expiresIn = '1h') {
  const key = new TextEncoder().encode(secret)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = TEST_SECRET
    process.env.NEXT_PUBLIC_APP_URL = 'https://livewell.mottisi.com'
  })

  it('always returns 200 even if email is not registered (anti-enumeration)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await forgotPost(
      makeRequest('https://livewell.mottisi.com/api/auth/forgot-password', {
        email: 'nobody@example.com',
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 200 and calls findUnique when email is registered', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'Test User',
    } as never)
    const res = await forgotPost(
      makeRequest('https://livewell.mottisi.com/api/auth/forgot-password', {
        email: 'user@example.com',
      }),
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user@example.com' } }),
    )
  })

  it('returns 400 for invalid email format', async () => {
    const res = await forgotPost(
      makeRequest('https://livewell.mottisi.com/api/auth/forgot-password', {
        email: 'not-an-email',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing email', async () => {
    const res = await forgotPost(
      makeRequest('https://livewell.mottisi.com/api/auth/forgot-password', {}),
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = TEST_SECRET
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1' } as never)
  })

  it('returns 200 and updates password hash with a valid reset token', async () => {
    const token = await signToken({ sub: 'u1', email: 'user@example.com', purpose: 'reset' })
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        token,
        password: 'newSecurePass123',
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    )
  })

  it('returns 400 for an expired token', async () => {
    const token = await signToken(
      { sub: 'u1', email: 'user@example.com', purpose: 'reset' },
      TEST_SECRET,
      '-1s', // already expired
    )
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        token,
        password: 'newSecurePass123',
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: { message?: string } }
    expect(body.error?.message).toMatch(/scaduto|valido/i)
  })

  it('returns 400 for a token signed with the wrong secret', async () => {
    const token = await signToken(
      { sub: 'u1', email: 'user@example.com', purpose: 'reset' },
      'completely-wrong-secret-padding-here!!',
    )
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        token,
        password: 'newSecurePass123',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for a token with wrong purpose', async () => {
    const token = await signToken({ sub: 'u1', email: 'user@example.com', purpose: 'auth' })
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        token,
        password: 'newSecurePass123',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const token = await signToken({ sub: 'u1', email: 'user@example.com', purpose: 'reset' })
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        token,
        password: 'short',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when no token is provided', async () => {
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        password: 'newSecurePass123',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 when NEXTAUTH_SECRET is not set', async () => {
    const token = await signToken({ sub: 'u1', email: 'user@example.com', purpose: 'reset' })
    delete process.env.NEXTAUTH_SECRET
    const res = await resetPost(
      makeRequest('https://livewell.mottisi.com/api/auth/reset-password', {
        token,
        password: 'newSecurePass123',
      }),
    )
    expect(res.status).toBe(500)
  })
})
