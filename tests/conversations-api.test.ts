import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE as deleteConversations } from '../src/app/api/conversations/route'
import { DELETE as deleteConversationById } from '../src/app/api/conversations/[id]/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

describe('Conversations API delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina tutto lo storico con DELETE /api/conversations', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(prisma.conversation.deleteMany).mockResolvedValue({ count: 3 })

    const req = new Request('http://localhost/api/conversations', {
      method: 'DELETE',
    })
    const res = await deleteConversations(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    })
    expect(body).toEqual({ deletedCount: 3 })
  })

  it('elimina singola conversazione con query param conversationId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(prisma.conversation.deleteMany).mockResolvedValue({ count: 1 })

    const req = new Request('http://localhost/api/conversations?conversationId=c42', {
      method: 'DELETE',
    })
    const res = await deleteConversations(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'c42', userId: 'u1' },
    })
    expect(body).toEqual({ deletedCount: 1 })
  })

  it('elimina singola conversazione con DELETE /api/conversations/[id]', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(prisma.conversation.deleteMany).mockResolvedValue({ count: 1 })

    const req = new Request('http://localhost/api/conversations/c42', {
      method: 'DELETE',
    })
    const res = await deleteConversationById(req, {
      params: Promise.resolve({ id: 'c42' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'c42', userId: 'u1' },
    })
    expect(body).toEqual({ deletedCount: 1 })
  })

  it('restituisce 404 quando la conversazione non esiste su route per id', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(prisma.conversation.deleteMany).mockResolvedValue({ count: 0 })

    const req = new Request('http://localhost/api/conversations/missing', {
      method: 'DELETE',
    })
    const res = await deleteConversationById(req, {
      params: Promise.resolve({ id: 'missing' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Conversazione non trovata' })
  })
})
