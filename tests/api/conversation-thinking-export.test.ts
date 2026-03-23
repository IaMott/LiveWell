import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  encodeAssistantContentWithThinking,
  stripAssistantStoredMetadata,
} from '@/lib/chat/thinkingPersistence'

const prismaMock = {
  conversation: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
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

vi.mock('@/lib/security/httpGuards', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

describe('conversation thinking persistence and export', () => {
  const storedAssistantContent = encodeAssistantContentWithThinking('Risposta finale', [
    {
      specialistName: 'Fisioterapista',
      title: 'Analisi in corso',
      thought:
        'Valuto il dolore e i trigger di movimento.\nIl pattern cronico suggerisce una componente muscolo-tensiva e posturale.',
      domain: 'health',
    },
    {
      specialistName: 'Nutrizionista',
      title: 'Confronto tra specialisti',
      thought: 'Verifico possibili trigger alimentari collegati',
      domain: 'nutrition',
    },
  ])

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.messageReview.findMany.mockResolvedValue([])
  })

  it('returns stripped content and thinkingSteps when loading a conversation', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      title: 'Conversazione',
      userId: 'user-1',
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: storedAssistantContent,
          domain: 'health',
          specialistName: 'Fisioterapista',
          createdAt: new Date('2026-03-23T18:00:00.000Z'),
        },
      ],
    })

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/route')

    const res = await GET(new Request('http://localhost/api/conversations/conv-1'), {
      params: Promise.resolve({ id: 'conv-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.messages[0].content).toBe('Risposta finale')
    expect(body.messages[0].thinkingSteps).toEqual([
      expect.objectContaining({
        specialistName: 'Fisioterapista',
        title: 'Analisi in corso',
        thought:
          'Valuto il dolore e i trigger di movimento.\nIl pattern cronico suggerisce una componente muscolo-tensiva e posturale.',
        domain: 'health',
      }),
      expect.objectContaining({
        specialistName: 'Nutrizionista',
        title: 'Confronto tra specialisti',
        thought: 'Verifico possibili trigger alimentari collegati',
        domain: 'nutrition',
      }),
    ])
  })

  it('strips hidden thinking metadata from conversation previews', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        title: 'Conversazione',
        updatedAt: new Date('2026-03-23T18:05:00.000Z'),
        messages: [
          {
            role: 'assistant',
            content: storedAssistantContent,
            domain: 'health',
            specialistName: 'Fisioterapista',
          },
        ],
      },
    ])

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/route')

    const res = await GET(new Request('http://localhost/api/conversations'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.conversations[0].preview).toBe(stripAssistantStoredMetadata(storedAssistantContent))
  })

  it('includes agent reasoning in the exported conversation text', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
      messages: [
        {
          id: 'assistant-msg-1',
          role: 'assistant',
          content: storedAssistantContent,
          createdAt: new Date('2026-03-23T18:00:00.000Z'),
        },
      ],
    })

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/export/route')

    const res = await GET(
      new Request('http://localhost/api/conversations/conv-1/export?includeFeedback=true'),
      { params: Promise.resolve({ id: 'conv-1' }) },
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toContain('Inclusi: feedback messaggi')
    expect(text).toContain('Inclusi: ragionamenti agenti')
    expect(text).toContain('Risposta finale')
    expect(text).toContain('Ragionamento agenti:')
    expect(text).toContain('- Fisioterapista [health]: Analisi in corso')
    expect(text).toContain('Valuto il dolore e i trigger di movimento')
    expect(text).toContain(
      'Il pattern cronico suggerisce una componente muscolo-tensiva e posturale.',
    )
    expect(text).toContain('- Nutrizionista [nutrition]: Confronto tra specialisti')
  })
})
