import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  conversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(async () => 'user-1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/chat/transcript', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.message.findMany.mockResolvedValue([])
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' })
  })

  it('persists live transcript messages sequentially, preserving order and assistant metadata', async () => {
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-live-1' })

    vi.resetModules()
    const { POST } = await import('@/app/api/chat/transcript/route')

    const res = await POST(
      new Request('http://localhost/api/chat/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: null,
          messages: [
            { role: 'user', content: 'Vorrei iniziare un percorso' },
            {
              role: 'assistant',
              content:
                'Payload: user.setAttribute domain:"health" key:"goal" value:"ricomposizione"\n\nTi aiuto a impostare il percorso.',
              domain: 'health',
              specialistName: 'Fisioterapista',
            },
          ],
        }),
      }),
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.message.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.message.create.mock.calls[0][0]).toMatchObject({
      data: {
        conversationId: 'conv-live-1',
        role: 'user',
        content: 'Vorrei iniziare un percorso',
      },
    })
    expect(prismaMock.message.create.mock.calls[1][0]).toMatchObject({
      data: {
        conversationId: 'conv-live-1',
        role: 'assistant',
        content: 'Ti aiuto a impostare il percorso.',
        domain: 'health',
        specialistName: 'Fisioterapista',
      },
    })
    expect(body).toMatchObject({
      ok: true,
      conversationId: 'conv-live-1',
      savedMessages: [
        { role: 'user', content: 'Vorrei iniziare un percorso' },
        {
          role: 'assistant',
          content: 'Ti aiuto a impostare il percorso.',
          domain: 'health',
          specialistName: 'Fisioterapista',
        },
      ],
    })
  })

  it('drops assistant transcript rows that only contain internal payload syntax', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv-1' })

    vi.resetModules()
    const { POST } = await import('@/app/api/chat/transcript/route')

    const res = await POST(
      new Request('http://localhost/api/chat/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-1',
          messages: [
            {
              role: 'assistant',
              content:
                'Payload: user.setAttribute domain:"health" key:"pathologies_notes" value:"..."',
              domain: 'health',
              specialistName: 'MMG',
            },
          ],
        }),
      }),
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      ok: true,
      conversationId: 'conv-1',
      savedMessages: [],
    })
  })

  it('preserves visible assistant text when an internal payload and visible text share the same line', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv-1' })

    vi.resetModules()
    const { POST } = await import('@/app/api/chat/transcript/route')

    const res = await POST(
      new Request('http://localhost/api/chat/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-1',
          messages: [
            {
              role: 'assistant',
              content:
                'Payload: user.setAttribute {"domain":"health","key":"goal","value":"forza"} Ti aiuto a impostare il percorso.',
              domain: 'health',
              specialistName: 'Fisioterapista',
            },
          ],
        }),
      }),
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Ti aiuto a impostare il percorso.',
        domain: 'health',
        specialistName: 'Fisioterapista',
      },
    })
    expect(body).toMatchObject({
      ok: true,
      conversationId: 'conv-1',
      savedMessages: [
        {
          role: 'assistant',
          content: 'Ti aiuto a impostare il percorso.',
          domain: 'health',
          specialistName: 'Fisioterapista',
        },
      ],
    })
  })
})
