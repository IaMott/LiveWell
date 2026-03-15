import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  conversation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  toolAuditLog: {
    create: vi.fn(),
  },
  agentWorkspace: {
    upsert: vi.fn(),
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
  // $transaction kept for fallback-test compatibility (tests mock rejection)
  $transaction: vi.fn(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops)
    return Promise.resolve()
  }),
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
    prismaMock.conversation.upsert.mockResolvedValue({ id: 'conv-db-1' })
    prismaMock.message.findMany.mockResolvedValue([])
    prismaMock.message.create.mockResolvedValue({ id: 'msg-1' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-db', role: 'OWNER' })
    prismaMock.notification.count.mockResolvedValue(0)
    prismaMock.notification.findFirst.mockResolvedValue(null)
    prismaMock.userProfile.findUnique.mockResolvedValue(null)
    prismaMock.userProfile.upsert.mockResolvedValue({ id: 'profile-1' })
    prismaMock.toolAuditLog.create.mockResolvedValue({ id: 'audit-1' })
    prismaMock.agentWorkspace.upsert.mockResolvedValue({ id: 'workspace-1' })
    prismaMock.bodyMetricEntry.create.mockResolvedValue({ id: 'metric-1' })
    prismaMock.userAttribute.create.mockResolvedValue({ id: 'attr-1' })
    prismaMock.userAttribute.findFirst.mockResolvedValue(null)
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

    // Sequential saves — no $transaction, each op is a direct prisma call
    expect(prismaMock.conversation.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.message.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.message.create.mock.calls[0][0]).toMatchObject({
      data: { conversationId: expect.any(String), role: 'user', content: 'ciao dal db' },
    })
    expect(prismaMock.message.create.mock.calls[1][0]).toMatchObject({
      data: { conversationId: expect.any(String), role: 'assistant' },
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

    expect(prismaMock.toolAuditLog.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.toolAuditLog.create.mock.calls[0][0]).toMatchObject({
      data: {
        userId: 'u-db',
        conversationId: expect.any(String),
        toolName: 'health.addMetric',
        status: 'success',
      },
    })

    // workspace upserts run outside the transaction (phase 2)
    const traceWorkspaceCall = prismaMock.agentWorkspace.upsert.mock.calls.find(
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

  it('falls back to streaming response when persistence fails (conversation upsert error)', async () => {
    prismaMock.conversation.upsert.mockRejectedValueOnce(new Error('db upsert failed'))
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
    // conversation upsert was attempted
    expect(prismaMock.conversation.upsert).toHaveBeenCalledTimes(1)
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
    // workspace upserts run in phase 2 (outside transaction)
    expect(prismaMock.agentWorkspace.upsert).toHaveBeenCalled()
    const agentIds = prismaMock.agentWorkspace.upsert.mock.calls.map(
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

    const traceWorkspaceCall = prismaMock.agentWorkspace.upsert.mock.calls.find(
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
