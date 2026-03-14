import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const txConversationUpdate = vi.fn()
const txMessageCreate = vi.fn()
const txToolAuditCreate = vi.fn()
const txAgentWorkspaceUpsert = vi.fn()

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
    upsert: vi.fn(),
  },
  // Required by realToolHandlers: health.addMetric calls prisma.bodyMetricEntry.create
  bodyMetricEntry: {
    create: vi.fn(),
  },
  // Required by realToolHandlers: user.setAttribute calls prisma.userAttribute.create
  userAttribute: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(
    async (
      callback: (tx: {
        conversation: { update: typeof txConversationUpdate }
        message: { create: typeof txMessageCreate }
        toolAuditLog: { create: typeof txToolAuditCreate }
        agentWorkspace: { upsert: typeof txAgentWorkspaceUpsert }
      }) => Promise<void>,
    ) =>
      callback({
        conversation: { update: txConversationUpdate },
        message: { create: txMessageCreate },
        toolAuditLog: { create: txToolAuditCreate },
        agentWorkspace: { upsert: txAgentWorkspaceUpsert },
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
    prismaMock.userProfile.upsert.mockResolvedValue({ id: 'profile-1' })
    prismaMock.toolAuditLog.create.mockResolvedValue({ id: 'audit-1' })
    prismaMock.bodyMetricEntry.create.mockResolvedValue({ id: 'metric-1' })
    prismaMock.userAttribute.create.mockResolvedValue({ id: 'attr-1' })
    prismaMock.userAttribute.findFirst.mockResolvedValue(null)
    txConversationUpdate.mockResolvedValue({ id: 'conv-db-1' })
    txMessageCreate.mockResolvedValue({ id: 'msg-tx' })
    txToolAuditCreate.mockResolvedValue({ id: 'audit-tx' })
    txAgentWorkspaceUpsert.mockResolvedValue({ id: 'workspace-tx' })
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

    const traceWorkspaceCall = txAgentWorkspaceUpsert.mock.calls.find(
      (c) => (c[0] as { create?: { agentId?: string } }).create?.agentId === 'orchestratore-trace',
    )
    expect(traceWorkspaceCall).toBeTruthy()
    expect(traceWorkspaceCall?.[0]).toMatchObject({
      create: {
        agentId: 'orchestratore-trace',
        round2Proposal: {
          summary: 'Tool execution trace',
          toolExecutionTrace: [
            expect.objectContaining({
              name: 'health.addMetric',
              ok: true,
            }),
          ],
        },
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

  it('smoke: /api/chat/send back-pain request persists AgentWorkspace proposals', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'ho mal di schiena lombare da 3 giorni' }),
    })

    const res = await POST(req)
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('"type":"message.complete"')
    expect(txAgentWorkspaceUpsert).toHaveBeenCalled()
    const agentIds = txAgentWorkspaceUpsert.mock.calls.map(
      (c) => (c[0] as { create?: { agentId?: string } }).create?.agentId,
    )
    expect(agentIds).toContain('fisioterapista')
  })

  it('persists blocked tool calls from retry guard into orchestratore-trace workspace', async () => {
    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'health',
        finalMessageMarkdown: 'Procediamo senza rieseguire quel tool.',
        toolCallsToExecute: [],
        ui: { domainIcon: 'health', moodScore: 50, sectionScores: { health: 60, general: 50 } },
        safety: { escalation: 'none' },
        debug: {
          selectedAgents: ['mmg'],
          conflicts: ['Blocked 1 non-retriable tool call(s) from recent trace'],
          blockedToolCalls: [
            {
              id: 'blocked-1',
              name: 'user.updateProfile',
              args: { fields: { weight: 80 } },
            },
          ],
        },
      })),
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'aggiorna di nuovo il peso' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const traceWorkspaceCall = txAgentWorkspaceUpsert.mock.calls.find(
      (c) => (c[0] as { create?: { agentId?: string } }).create?.agentId === 'orchestratore-trace',
    )
    expect(traceWorkspaceCall).toBeTruthy()
    expect(traceWorkspaceCall?.[0]).toMatchObject({
      create: {
        agentId: 'orchestratore-trace',
        round2Proposal: {
          toolExecutionTrace: [
            expect.objectContaining({
              toolCallId: 'blocked-1',
              name: 'user.updateProfile',
              ok: false,
              code: 'RETRY_GUARD_BLOCKED',
            }),
          ],
        },
      },
    })
  })

  it('streams agent.thinking events with specialist switch titles before response deltas', async () => {
    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'training',
        finalMessageMarkdown:
          'Ti aiuto con il dolore lombare. Dimmi quando è iniziato esattamente.',
        toolCallsToExecute: [],
        activeSpecialist: {
          id: 'fisioterapista',
          displayName: 'Fisioterapista',
          domain: 'training',
          domains: ['training', 'health'],
        },
        ui: { domainIcon: 'training', moodScore: 50, sectionScores: { training: 60, general: 50 } },
        safety: { escalation: 'none' },
        debug: {
          selectedAgents: ['fisioterapista', 'fisiatra'],
          conflicts: [],
          round1Proposals: [
            {
              agentId: 'fisioterapista',
              domain: 'training',
              summary: 'Valuto pattern del dolore e trigger meccanici',
              reasoning: 'r1',
            },
            {
              agentId: 'fisiatra',
              domain: 'health',
              summary: 'Escludo red flags cliniche immediate',
              reasoning: 'r1',
            },
          ],
          round2Proposals: [],
        },
      })),
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'ho mal di schiena' }),
    })

    const res = await POST(req)
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('"type":"agent.thinking"')
    expect(body).toContain('Valuto pattern del dolore')
    expect(body).toContain('Escludo red flags cliniche')
    expect(body).toContain('"type":"message.complete"')
  })

  it('does not return 500 when orchestrate throws (safe fallback response)', async () => {
    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => {
        throw new Error('orchestrate boom')
      }),
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'in allenamento mi alleno 4 volte a settimana' }),
    })

    const res = await POST(req)
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('"type":"message.complete"')
    expect(body.toLowerCase()).toContain('procediamo')
    expect(body.toLowerCase()).not.toContain('problema tecnico')
  })
})
