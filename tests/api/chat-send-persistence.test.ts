import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const txMessageCreate = vi.fn()
const txToolAuditCreate = vi.fn()

const prismaMock = {
  conversation: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
  },
  toolAuditLog: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  notification: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  userProfile: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(
    async (
      callback: (tx: {
        message: { create: typeof txMessageCreate }
        toolAuditLog: { create: typeof txToolAuditCreate }
      }) => Promise<void>,
    ) =>
      callback({
        message: { create: txMessageCreate },
        toolAuditLog: { create: txToolAuditCreate },
      }),
  ),
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/chat/send persistence integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_DB_IN_TEST = '1'

    prismaMock.conversation.findUnique.mockResolvedValue(null)
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-db-1' })
    prismaMock.message.findMany.mockResolvedValue([])
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-db', role: 'OWNER' })
    prismaMock.notification.count.mockResolvedValue(0)
    prismaMock.notification.findFirst.mockResolvedValue(null)
    prismaMock.userProfile.findUnique.mockResolvedValue(null)
    prismaMock.toolAuditLog.create.mockResolvedValue({ id: 'audit-1' })
    txMessageCreate.mockResolvedValue({ id: 'msg-tx' })
    txToolAuditCreate.mockResolvedValue({ id: 'audit-tx' })
  })

  afterEach(() => {
    delete process.env.ENABLE_DB_IN_TEST
  })

  it('persists user+assistant messages in a transaction when DB persistence is enabled', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
        'x-user-role': 'OWNER',
        'x-owner-mode-enabled': 'true',
      },
      body: JSON.stringify({ message: 'ciao dal db' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(txMessageCreate).toHaveBeenCalledTimes(2)
    expect(txMessageCreate.mock.calls[0][0]).toMatchObject({
      data: { conversationId: 'conv-db-1', role: 'user', content: 'ciao dal db' },
    })
    expect(txMessageCreate.mock.calls[1][0]).toMatchObject({
      data: { conversationId: 'conv-db-1', role: 'assistant' },
    })
  })

  it('persists tool audit logs for executed mutation tools inside transaction', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({
        message: '/tool health.addMetric {"metricType":"weight","value":82.1}',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(txToolAuditCreate).toHaveBeenCalledTimes(1)
    expect(txToolAuditCreate.mock.calls[0][0]).toMatchObject({
      data: {
        userId: 'u-db',
        conversationId: 'conv-db-1',
        toolName: 'health.addMetric',
        status: 'success',
      },
    })
  })

  it('falls back to streaming response when transaction persistence fails', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error('db transaction failed'))
    vi.resetModules()
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'fallback test' }),
    })

    const res = await POST(req)
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('"type":"message.complete"')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
