import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  conversation: {
    findFirst: vi.fn(),
  },
  messageReview: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/conversations/[id]/export feedback annotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes feedback when the review messageId matches the persisted assistant message', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
      messages: [
        {
          id: 'user-msg-1',
          role: 'user',
          content: 'Ciao',
          createdAt: new Date('2026-03-23T17:00:00.000Z'),
        },
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          content: 'Risposta 1',
          createdAt: new Date('2026-03-23T17:01:00.000Z'),
        },
      ],
    })
    prismaMock.messageReview.findMany.mockResolvedValue([
      {
        messageId: 'assistant-msg-1',
        rating: 4,
        comment: 'Molto utile',
        agentName: 'Fisioterapista',
        createdAt: new Date('2026-03-23T17:02:00.000Z'),
      },
    ])

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/export/route')

    const res = await GET(
      new Request('http://localhost/api/conversations/conv-1/export?includeFeedback=true'),
      { params: Promise.resolve({ id: 'conv-1' }) },
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toContain('Inclusi: feedback messaggi')
    expect(text).toContain('★★★★☆ Buono [Fisioterapista] — "Molto utile"')
  })

  it('falls back to the closest previous assistant message for legacy feedback saved with a transient id', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-legacy',
      userId: 'user-1',
      messages: [
        {
          id: 'user-msg-1',
          role: 'user',
          content: 'Primo messaggio',
          createdAt: new Date('2026-03-23T17:00:00.000Z'),
        },
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          content: 'Prima risposta',
          createdAt: new Date('2026-03-23T17:01:00.000Z'),
        },
        {
          id: 'user-msg-2',
          role: 'user',
          content: 'Secondo messaggio',
          createdAt: new Date('2026-03-23T17:02:00.000Z'),
        },
        {
          id: 'assistant-msg-2',
          role: 'assistant',
          content: 'Seconda risposta',
          createdAt: new Date('2026-03-23T17:03:00.000Z'),
        },
      ],
    })
    prismaMock.messageReview.findMany.mockResolvedValue([
      {
        messageId: 'client-temp-id-123',
        rating: 2,
        comment: 'Mancano dettagli',
        agentName: 'Fisioterapista',
        createdAt: new Date('2026-03-23T17:03:30.000Z'),
      },
    ])

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/export/route')

    const res = await GET(
      new Request('http://localhost/api/conversations/conv-legacy/export?includeFeedback=true'),
      { params: Promise.resolve({ id: 'conv-legacy' }) },
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toContain('Seconda risposta')
    expect(text).toContain('★★☆☆☆ Scarso [Fisioterapista] — "Mancano dettagli"')
    expect(text).not.toContain(
      'Prima risposta\n  ★★☆☆☆ Scarso [Fisioterapista] — "Mancano dettagli"',
    )
  })
})
