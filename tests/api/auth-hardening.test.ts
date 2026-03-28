/**
 * Auth hardening tests (F1).
 *
 * Verifies the double-guard pattern on all three getAuth* functions:
 * - x-user-id / x-user-role / x-owner-mode-enabled headers are accepted ONLY
 *   when both NODE_ENV=test AND AUTH_ALLOW_TEST_HEADERS=true.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Import the REAL auth module (not the mock alias) via the relative path so
// we can test its internal guard logic directly.
const AUTH_MODULE = '../../src/lib/auth'

// Prisma is called inside getAuthUserId — mock it so we don't hit a real DB.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({ id: 'db-user-id' })),
    },
  },
}))

// next-auth's `auth()` is called in production path — mock it.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(async () => null),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))
vi.mock('next-auth/providers/credentials', () => ({ default: vi.fn(() => ({})) }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }))

describe('auth double-guard (F1)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ─── getAuthUserId ────────────────────────────────────────────────────────

  it('getAuthUserId: ignores x-user-id when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.AUTH_ALLOW_TEST_HEADERS = 'true'
    const { getAuthUserId } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-user-id': 'injected-id' },
    })
    // In production the header bypass must be disabled regardless of AUTH_ALLOW_TEST_HEADERS.
    // auth() returns null → userId is null.
    const result = await getAuthUserId(req)
    expect(result).not.toBe('injected-id')
  })

  it('getAuthUserId: ignores x-user-id when NODE_ENV=test but AUTH_ALLOW_TEST_HEADERS unset', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.AUTH_ALLOW_TEST_HEADERS
    const { getAuthUserId } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-user-id': 'injected-id' },
    })
    const result = await getAuthUserId(req)
    expect(result).not.toBe('injected-id')
  })

  it('getAuthUserId: honours x-user-id when NODE_ENV=test AND AUTH_ALLOW_TEST_HEADERS=true', async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_ALLOW_TEST_HEADERS = 'true'
    const { getAuthUserId } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-user-id': 'test-uid' },
    })
    const result = await getAuthUserId(req)
    expect(result).toBe('test-uid')
  })

  // ─── getAuthRole ─────────────────────────────────────────────────────────

  it('getAuthRole: ignores x-user-role header when NODE_ENV=test but AUTH_ALLOW_TEST_HEADERS unset', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.AUTH_ALLOW_TEST_HEADERS
    const { getAuthRole } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-user-role': 'OWNER' },
    })
    const result = await getAuthRole(req)
    // auth() returns null → role falls through to 'USER'
    expect(result).toBe('USER')
  })

  it('getAuthRole: honours OWNER role header when double-guard passes', async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_ALLOW_TEST_HEADERS = 'true'
    const { getAuthRole } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-user-role': 'OWNER' },
    })
    const result = await getAuthRole(req)
    expect(result).toBe('OWNER')
  })

  // ─── getAuthOwnerMode ────────────────────────────────────────────────────

  it('getAuthOwnerMode: ignores x-owner-mode-enabled when AUTH_ALLOW_TEST_HEADERS unset', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.AUTH_ALLOW_TEST_HEADERS
    const { getAuthOwnerMode } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-owner-mode-enabled': '1' },
    })
    const result = await getAuthOwnerMode(req)
    expect(result).toBe(false)
  })

  it('getAuthOwnerMode: honours flag when double-guard passes', async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_ALLOW_TEST_HEADERS = 'true'
    const { getAuthOwnerMode } = await import(AUTH_MODULE)
    const req = new Request('http://localhost/', {
      headers: { 'x-owner-mode-enabled': '1' },
    })
    const result = await getAuthOwnerMode(req)
    expect(result).toBe(true)
  })
})
