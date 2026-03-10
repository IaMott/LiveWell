import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/admin/monitoring/errors/route'

const { mockGetApiErrorDashboard } = vi.hoisted(() => ({
  mockGetApiErrorDashboard: vi.fn(async () => ({
    windowHours: 24,
    totals: { errors: 0, byEndpoint: [], byErrorCode: [], byStatus: [] },
    recent: [],
  })),
}))

vi.mock('@/lib/monitoring/apiErrorEvents', () => ({
  getApiErrorDashboard: mockGetApiErrorDashboard,
}))

vi.mock('@/lib/security/httpGuards', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/httpGuards')>(
    '@/lib/security/httpGuards',
  )
  return {
    ...actual,
    checkRateLimit: vi.fn(() => ({ ok: true, remaining: 59, resetAt: Date.now() + 60_000 })),
    getClientIp: vi.fn(() => '127.0.0.1'),
  }
})

describe('/api/admin/monitoring/errors', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    mockGetApiErrorDashboard.mockClear()
  })

  it('returns 401 when unauthenticated', async () => {
    const req = new Request('http://localhost/api/admin/monitoring/errors')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-owner users', async () => {
    const req = new Request('http://localhost/api/admin/monitoring/errors', {
      headers: { 'x-user-id': 'u1', 'x-user-role': 'USER' },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns dashboard payload for OWNER and clamps query params', async () => {
    const req = new Request('http://localhost/api/admin/monitoring/errors?hours=999&take=999', {
      headers: { 'x-user-id': 'owner-1', 'x-user-role': 'OWNER' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)

    expect(mockGetApiErrorDashboard).toHaveBeenCalledWith({
      hours: 168,
      take: 200,
    })

    const body = await res.json()
    expect(body).toHaveProperty('totals')
    expect(body).toHaveProperty('recent')
  })
})
