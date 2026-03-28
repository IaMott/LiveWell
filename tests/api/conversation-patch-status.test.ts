/**
 * Tests for PATCH /api/conversations/[id] — the write path that makes
 * caseStatus / casePriority actually functional (not "merged on paper").
 *
 * Without this endpoint the fields could never change from their defaults
 * (active / normal), making the backlog/priority UI purely cosmetic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PATCH } from '../../src/app/api/conversations/[id]/route'

// ── Auth mock ────────────────────────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(async (req: Request) => req.headers.get('x-user-id') ?? null),
  getAuthRole: vi.fn(async () => 'USER' as const),
  getAuthOwnerMode: vi.fn(async () => false),
}))

// ── Prisma mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(body: unknown, userId = 'u1') {
  return new Request('http://localhost/api/conversations/conv1', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify(body),
  })
}

const mockParams = Promise.resolve({ id: 'conv1' })

describe('PATCH /api/conversations/[id] — caseStatus / casePriority write path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ userId: 'u1' } as never)
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv1',
      title: 'Test',
      caseStatus: 'open',
      casePriority: 'high',
      updatedAt: new Date(),
    } as never)
  })

  it('returns 401 if not authenticated', async () => {
    const req = new Request('http://localhost/api/conversations/conv1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseStatus: 'open' }),
    })
    const res = await PATCH(req, { params: mockParams })
    expect(res.status).toBe(401)
  })

  it('returns 404 if conversation not found', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ caseStatus: 'open' }), { params: mockParams })
    expect(res.status).toBe(404)
  })

  it('returns 404 if conversation belongs to another user', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ userId: 'other-user' } as never)
    const res = await PATCH(makeRequest({ caseStatus: 'open' }), { params: mockParams })
    expect(res.status).toBe(404)
  })

  it('returns 400 if no fields provided', async () => {
    const res = await PATCH(makeRequest({}), { params: mockParams })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid caseStatus value', async () => {
    const res = await PATCH(makeRequest({ caseStatus: 'invalid-status' }), { params: mockParams })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid casePriority value', async () => {
    const res = await PATCH(makeRequest({ casePriority: 'critical' }), { params: mockParams })
    expect(res.status).toBe(400)
  })

  it('updates caseStatus to open (backlog vivo → open)', async () => {
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv1',
      title: 'Test',
      caseStatus: 'open',
      casePriority: 'normal',
      updatedAt: new Date(),
    } as never)
    const res = await PATCH(makeRequest({ caseStatus: 'open' }), { params: mockParams })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { conversation: { caseStatus: string } }
    expect(body.conversation.caseStatus).toBe('open')
    expect(vi.mocked(prisma.conversation.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseStatus: 'open' }),
      }),
    )
  })

  it('updates casePriority to urgent', async () => {
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv1',
      title: 'Test',
      caseStatus: 'active',
      casePriority: 'urgent',
      updatedAt: new Date(),
    } as never)
    const res = await PATCH(makeRequest({ casePriority: 'urgent' }), { params: mockParams })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { conversation: { casePriority: string } }
    expect(body.conversation.casePriority).toBe('urgent')
  })

  it('can archive a conversation (caseStatus = archived)', async () => {
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv1',
      title: 'Test',
      caseStatus: 'archived',
      casePriority: 'normal',
      updatedAt: new Date(),
    } as never)
    const res = await PATCH(makeRequest({ caseStatus: 'archived' }), { params: mockParams })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { conversation: { caseStatus: string } }
    expect(body.conversation.caseStatus).toBe('archived')
  })

  it('updates both status and priority together', async () => {
    const res = await PATCH(makeRequest({ caseStatus: 'pending', casePriority: 'high' }), {
      params: mockParams,
    })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.conversation.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseStatus: 'pending', casePriority: 'high' }),
      }),
    )
  })

  it('accepts completed status (close a case)', async () => {
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv1',
      title: 'Test',
      caseStatus: 'completed',
      casePriority: 'normal',
      updatedAt: new Date(),
    } as never)
    const res = await PATCH(makeRequest({ caseStatus: 'completed' }), { params: mockParams })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { conversation: { caseStatus: string } }
    expect(body.conversation.caseStatus).toBe('completed')
  })
})
