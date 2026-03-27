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
  caseState: {
    findUnique: vi.fn(),
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
    prismaMock.caseState.findUnique.mockResolvedValue(null)
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

  it('strips leaked internal payload lines from loaded and exported assistant content', async () => {
    const leakedStoredAssistantContent = encodeAssistantContentWithThinking(
      'Payload: user.setAttribute domain:"health" key:"pathologies_notes" value:"spalla"\n\nRisposta clinica utile',
      [],
    )

    prismaMock.conversation.findUnique.mockResolvedValue({
      id: 'conv-2',
      title: 'Conversazione',
      userId: 'user-1',
      messages: [
        {
          id: 'msg-2',
          role: 'assistant',
          content: leakedStoredAssistantContent,
          domain: 'health',
          specialistName: 'Fisioterapista',
          createdAt: new Date('2026-03-23T18:00:00.000Z'),
        },
      ],
    })

    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-2',
      userId: 'user-1',
      messages: [
        {
          id: 'msg-2',
          role: 'assistant',
          content: leakedStoredAssistantContent,
          createdAt: new Date('2026-03-23T18:00:00.000Z'),
        },
      ],
    })

    vi.resetModules()
    const { GET: getConversation } = await import('@/app/api/conversations/[id]/route')
    const { GET: exportConversation } = await import('@/app/api/conversations/[id]/export/route')

    const loadRes = await getConversation(
      new Request('http://localhost/api/conversations/conv-2'),
      {
        params: Promise.resolve({ id: 'conv-2' }),
      },
    )
    const loadBody = await loadRes.json()

    const exportRes = await exportConversation(
      new Request('http://localhost/api/conversations/conv-2/export'),
      { params: Promise.resolve({ id: 'conv-2' }) },
    )
    const exportText = await exportRes.text()

    expect(loadRes.status).toBe(200)
    expect(loadBody.messages[0].content).toBe('Risposta clinica utile')
    expect(exportText).toContain('Risposta clinica utile')
    expect(exportText).not.toContain('Payload: user.setAttribute')
  })

  it('keeps visible assistant text when stored content mixes payload and message on the same line', async () => {
    const assistantContent =
      'Payload: user.setAttribute {"domain":"health","key":"goal","value":"forza"} Ti aiuto a impostare il percorso.'

    prismaMock.conversation.findUnique.mockResolvedValue({
      id: 'conv-export-inline',
      title: 'Conversazione test',
      userId: 'user-1',
      messages: [
        {
          id: 'msg-user-inline',
          role: 'user',
          content: 'va bene',
          domain: null,
          specialistName: null,
          createdAt: new Date('2026-03-27T20:36:15.527Z'),
        },
        {
          id: 'msg-assistant-inline',
          role: 'assistant',
          content: assistantContent,
          domain: 'training',
          specialistName: 'Fisioterapista',
          createdAt: new Date('2026-03-27T20:37:38.919Z'),
        },
      ],
    })

    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-export-inline',
      title: 'Conversazione test',
      userId: 'user-1',
      messages: [
        {
          id: 'msg-user-inline',
          role: 'user',
          content: 'va bene',
          createdAt: new Date('2026-03-27T20:36:15.527Z'),
          attachments: [],
        },
        {
          id: 'msg-assistant-inline',
          role: 'assistant',
          content: assistantContent,
          createdAt: new Date('2026-03-27T20:37:38.919Z'),
          attachments: [],
        },
      ],
    })

    const { GET: getConversation } = await import('@/app/api/conversations/[id]/route')
    const conversationRes = await getConversation(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'conv-export-inline' }),
    })
    const conversationBody = await conversationRes.json()

    const { GET: getExport } = await import('@/app/api/conversations/[id]/export/route')
    const exportRes = await getExport(
      new Request('http://localhost/api/conversations/conv-export-inline/export'),
      {
        params: Promise.resolve({ id: 'conv-export-inline' }),
      },
    )
    const exportText = await exportRes.text()

    expect(conversationBody.messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: 'va bene',
      }),
      expect.objectContaining({
        role: 'assistant',
        content: 'Ti aiuto a impostare il percorso.',
      }),
    ])
    expect(exportText).toContain('Ti aiuto a impostare il percorso.')
    expect(exportText).not.toContain('Payload: user.setAttribute')
  })
})
