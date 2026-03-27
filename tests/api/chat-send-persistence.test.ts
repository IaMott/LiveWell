import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeAssistantStoredContent } from '@/lib/chat/thinkingPersistence'

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
  caseState: {
    findUnique: vi.fn(),
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
  clinicalEvent: {
    create: vi.fn(),
  },
  // Required by realToolHandlers: user.setAttribute calls prisma.userAttribute.create
  userAttribute: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
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

function extractSseEvent(body: string, type: string): Record<string, unknown> | null {
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
      if (parsed.type === type) return parsed
    } catch {
      // ignore malformed SSE lines in tests
    }
  }
  return null
}

describe('/api/chat/send persistence integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.doUnmock('@/lib/ai/team/loader')
    vi.doUnmock('@/lib/tools/toolExecutor')
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
    prismaMock.caseState.findUnique.mockResolvedValue(null)
    prismaMock.caseState.upsert.mockResolvedValue({ id: 'case-1' })
    prismaMock.bodyMetricEntry.create.mockResolvedValue({ id: 'metric-1' })
    prismaMock.clinicalEvent.create.mockResolvedValue({ id: 'clinical-1' })
    prismaMock.userAttribute.create.mockResolvedValue({ id: 'attr-1' })
    prismaMock.userAttribute.findFirst.mockResolvedValue(null)
    prismaMock.userAttribute.findMany.mockResolvedValue([])
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
    // Consume the stream so the ReadableStream start() async body completes
    // and all persistence calls (inside the stream) have been awaited.
    const body = await res.text()

    // Sequential saves — no $transaction, each op is a direct prisma call
    expect(prismaMock.conversation.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.message.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.message.create.mock.calls[0][0]).toMatchObject({
      data: { conversationId: expect.any(String), role: 'user', content: 'ciao dal db' },
    })
    const streamedAssistantId = body.match(/"type":"message\.complete","id":"([^"]+)"/)?.[1]
    expect(streamedAssistantId).toBeTruthy()
    expect(prismaMock.message.create.mock.calls[1][0]).toMatchObject({
      data: {
        id: streamedAssistantId,
        conversationId: expect.any(String),
        role: 'assistant',
      },
    })
    const storedAssistantContent = prismaMock.message.create.mock.calls[1][0].data.content
    expect(storedAssistantContent).toContain('<!--LIVEWELL_THINKING_V1:')
    const decodedAssistant = decodeAssistantStoredContent(storedAssistantContent)
    expect(decodedAssistant.content.length).toBeGreaterThan(0)
    expect(decodedAssistant.thinkingSteps?.length).toBeGreaterThan(0)
  })

  it('persists full proposal reasoning instead of only generic stream status labels', async () => {
    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'health',
        finalMessageMarkdown: 'Ti spiego cosa noto dal quadro clinico.',
        toolCallsToExecute: [],
        caseState: undefined,
        protocolEvents: [],
        activeSpecialist: {
          id: 'fisioterapista',
          displayName: 'Fisioterapista',
          domain: 'training',
          domains: ['training', 'health'],
        },
        ui: { domainIcon: 'health', moodScore: 50, sectionScores: { health: 60, general: 50 } },
        safety: { escalation: 'none' },
        debug: {
          selectedAgents: ['fisioterapista'],
          conflicts: [],
          round1Proposals: [
            {
              agentId: 'fisioterapista',
              domain: 'training',
              summary: 'Il quadro suggerisce una componente muscolo-tensiva del trapezio sinistro',
              reasoning:
                'Il dolore cronico al trapezio sinistro, associato a posizione seduta prolungata e risvegli notturni, fa pensare a una componente muscolo-tensiva con possibile sovraccarico posturale.\nServe confermare se ci sono irradiazioni, limitazione del movimento o diagnosi strumentale recente.',
              confidence: 0.91,
            },
          ],
          round2Proposals: [],
        },
      })),
      ORCHESTRATION_BUDGET_MS: 30000,
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'ho dolore al trapezio sinistro da mesi' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await res.text()

    const storedAssistantContent = prismaMock.message.create.mock.calls[1][0].data.content
    const decodedAssistant = decodeAssistantStoredContent(storedAssistantContent)

    expect(decodedAssistant.thinkingSteps).toEqual([
      expect.objectContaining({
        specialistName: 'Fisioterapista',
        title: 'Il quadro suggerisce una componente muscolo-tensiva del trapezio sinistro',
        thought: expect.stringContaining('componente muscolo-tensiva'),
      }),
    ])
    expect(decodedAssistant.thinkingSteps?.[0]?.thought).toContain(
      'Serve confermare se ci sono irradiazioni',
    )
    expect(decodedAssistant.thinkingSteps?.[0]?.title).not.toBe('Analisi in corso')
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
    // Consume stream so all async persistence calls inside ReadableStream.start() complete
    await res.text()

    expect(prismaMock.toolAuditLog.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.toolAuditLog.create.mock.calls[0][0]).toMatchObject({
      data: {
        userId: 'u-db',
        conversationId: expect.any(String),
        toolName: 'health.addMetric',
        status: expect.any(String),
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
    // conversation upsert was attempted — withRetry retries once on failure, so 2 calls total
    expect(prismaMock.conversation.upsert).toHaveBeenCalledTimes(2)
  })

  it('reads canonical runtime state via RoutePersistenceDeps when stateSnapshot is present', async () => {
    vi.resetModules()
    prismaMock.caseState.findUnique.mockResolvedValue({
      conversationId: 'conv-db-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'consult_active_takeover',
      stateSnapshot: {
        schemaVersion: 1,
        conversationId: 'conv-db-1',
        activeDomains: ['nutrition'],
        domainPanels: [
          {
            domain: 'nutrition',
            selectedAgentId: 'dietista',
            candidateAgentIds: ['dietista'],
            status: 'active',
            priorityScore: 8,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
        leadDomain: 'nutrition',
        speakerPolicy: 'lead',
        conversationFocus: {
          activeProblems: ['gonfiore'],
          activeGoals: ['ridurre sintomi'],
          activeConstraints: [],
          summary: 'focus nutrizione',
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: [],
          needsReview: false,
        },
        sharedOpenQuestions: [],
        domainOpenQuestions: {},
        updatedAt: '2026-03-26T23:45:00.000Z',
      },
    })

    const { createDbPersistenceDeps } = await import('@/app/api/chat/send/chatPersistence')
    const deps = createDbPersistenceDeps(true)
    const state = await deps.getCaseRuntimeState({ conversationId: 'conv-db-1' })

    expect(state?.leadDomain).toBe('nutrition')
    expect(state?.activeDomains).toEqual(['nutrition'])
    expect(state?.domainPanels[0]?.selectedAgentId).toBe('dietista')
  })

  it('writes canonical runtime state through RoutePersistenceDeps with snapshot as primary payload', async () => {
    vi.resetModules()
    const { createDbPersistenceDeps } = await import('@/app/api/chat/send/chatPersistence')
    const deps = createDbPersistenceDeps(true)

    await deps.persistCaseRuntimeState({
      userId: 'u-db',
      conversationId: 'conv-db-1',
      caseState: {
        schemaVersion: 1,
        conversationId: 'conv-db-1',
        activeDomains: ['health'],
        domainPanels: [
          {
            domain: 'health',
            selectedAgentId: 'fisiatra',
            candidateAgentIds: ['fisiatra', 'mmg'],
            status: 'active',
            priorityScore: 10,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
        leadDomain: 'health',
        speakerPolicy: 'lead',
        conversationFocus: {
          activeProblems: ['dolore lombare'],
          activeGoals: ['ridurre dolore'],
          activeConstraints: [],
          summary: 'focus clinico',
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: [],
          needsReview: false,
        },
        sharedOpenQuestions: [],
        domainOpenQuestions: {},
        updatedAt: '2026-03-26T23:46:00.000Z',
      },
    })

    expect(prismaMock.caseState.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.caseState.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { conversationId: 'conv-db-1' },
      create: {
        userId: 'u-db',
        conversationId: 'conv-db-1',
        stateSnapshot: expect.objectContaining({
          leadDomain: 'health',
          activeDomains: ['health'],
        }),
      },
      update: {
        stateSnapshot: expect.objectContaining({
          leadDomain: 'health',
          activeDomains: ['health'],
        }),
      },
    })
  })

  it('passes canonical caseStateSnapshot to orchestrate without rebuilding a legacy adapter in the route hot path', async () => {
    prismaMock.caseState.findUnique.mockResolvedValue({
      conversationId: 'conv-db-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'owner_active',
      stateSnapshot: {
        schemaVersion: 1,
        conversationId: 'conv-db-1',
        activeDomains: ['nutrition'],
        domainPanels: [
          {
            domain: 'nutrition',
            selectedAgentId: 'dietista',
            candidateAgentIds: ['dietista'],
            status: 'active',
            priorityScore: 9,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
        leadDomain: 'nutrition',
        speakerPolicy: 'lead',
        conversationFocus: {
          activeProblems: ['gonfiore'],
          activeGoals: ['ridurre sintomi'],
          activeConstraints: [],
          summary: 'focus nutrizione',
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: [],
          needsReview: false,
        },
        sharedOpenQuestions: [],
        domainOpenQuestions: {},
        updatedAt: '2026-03-26T23:50:00.000Z',
      },
    })

    vi.resetModules()
    const orchestrateMock = vi.fn(async (_deps, input) => ({
      domain: 'nutrition',
      finalMessageMarkdown: 'ok',
      toolCallsToExecute: [],
      caseState: input.caseState ?? undefined,
      stateSnapshot: input.caseStateSnapshot ?? undefined,
      protocolEvents: [],
      ui: { domainIcon: 'nutrition', moodScore: 50, sectionScores: { nutrition: 60, general: 50 } },
      safety: { escalation: 'none' },
      debug: { selectedAgents: [], conflicts: [] },
    }))
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: orchestrateMock,
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const res = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u-db',
        },
        body: JSON.stringify({ message: 'ho gonfiore dopo i pasti' }),
      }),
    )

    expect(res.status).toBe(200)
    await res.text()

    expect(orchestrateMock).toHaveBeenCalledTimes(1)
    expect(orchestrateMock.mock.calls[0]?.[1].caseStateSnapshot).toMatchObject({
      leadDomain: 'nutrition',
      activeDomains: ['nutrition'],
    })
    expect(orchestrateMock.mock.calls[0]?.[1].caseState).toBeNull()
  })

  it('persists the canonical runtime payload directly when orchestrate already returns stateSnapshot', async () => {
    prismaMock.caseState.findUnique.mockResolvedValue(null)

    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'nutrition',
        finalMessageMarkdown: 'ok',
        toolCallsToExecute: [],
        caseState: undefined,
        stateSnapshot: {
          schemaVersion: 1,
          conversationId: 'conv-db-1',
          activeDomains: ['nutrition'],
          domainPanels: [
            {
              domain: 'nutrition',
              selectedAgentId: 'dietista',
              candidateAgentIds: ['dietista'],
              status: 'active',
              priorityScore: 9,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
          ],
          leadDomain: 'nutrition',
          speakerPolicy: 'lead',
          conversationFocus: {
            activeProblems: ['gonfiore'],
            activeGoals: ['capire la causa'],
            activeConstraints: [],
            summary: 'focus panel',
          },
          coordinationState: {
            crossDomainConflicts: [],
            dependencies: [],
            needsReview: false,
          },
          sharedOpenQuestions: [],
          domainOpenQuestions: {},
          updatedAt: '2026-03-27T16:30:00.000Z',
        },
        protocolEvents: [],
        activeSpecialist: undefined,
        ui: {
          domainIcon: 'nutrition',
          moodScore: 50,
          sectionScores: { nutrition: 60, general: 50 },
        },
        safety: { escalation: 'none' },
        debug: { selectedAgents: [], conflicts: [] },
      })),
      ORCHESTRATION_BUDGET_MS: 30000,
    }))

    const { POST } = await import('@/app/api/chat/send/route')

    const res = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u-db',
        },
        body: JSON.stringify({ message: 'ho gonfiore dopo i pasti' }),
      }),
    )

    expect(res.status).toBe(200)
    await res.text()

    expect(prismaMock.caseState.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.caseState.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { conversationId: 'conv-db-1' },
      create: expect.objectContaining({
        stateSnapshot: expect.objectContaining({
          leadDomain: 'nutrition',
          activeDomains: ['nutrition'],
        }),
        ownerAgentId: 'dietista',
        activeSpeakerAgentId: 'dietista',
      }),
      update: expect.objectContaining({
        stateSnapshot: expect.objectContaining({
          leadDomain: 'nutrition',
          activeDomains: ['nutrition'],
        }),
      }),
    })
  })

  it('derives ui.state compatibility fields from the canonical lead panel when activeSpecialist is absent', async () => {
    prismaMock.caseState.findUnique.mockResolvedValue(null)

    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'nutrition',
        finalMessageMarkdown: 'ok',
        toolCallsToExecute: [],
        caseState: undefined,
        stateSnapshot: {
          schemaVersion: 1,
          conversationId: 'conv-db-1',
          activeDomains: ['nutrition', 'health'],
          domainPanels: [
            {
              domain: 'nutrition',
              selectedAgentId: 'dietista',
              candidateAgentIds: ['dietista'],
              status: 'active',
              priorityScore: 9,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
            {
              domain: 'health',
              selectedAgentId: 'fisiatra',
              candidateAgentIds: ['fisiatra'],
              status: 'active',
              priorityScore: 7,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
          ],
          leadDomain: 'nutrition',
          speakerPolicy: 'lead',
          conversationFocus: {
            activeProblems: ['gonfiore'],
            activeGoals: ['capire la causa'],
            activeConstraints: [],
            summary: 'focus panel',
          },
          coordinationState: {
            crossDomainConflicts: [],
            dependencies: [],
            needsReview: false,
          },
          sharedOpenQuestions: [],
          domainOpenQuestions: {},
          updatedAt: '2026-03-26T23:58:00.000Z',
        },
        protocolEvents: [],
        ui: { domainIcon: 'general', moodScore: 50, sectionScores: { nutrition: 60, general: 50 } },
        safety: { escalation: 'none' },
        debug: { selectedAgents: ['dietista', 'fisiatra'], conflicts: [] },
      })),
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const res = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u-db',
        },
        body: JSON.stringify({ message: 'ho gonfiore dopo i pasti' }),
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.text()
    const uiState = extractSseEvent(body, 'ui.state')

    expect(uiState).toMatchObject({
      domain: 'nutrition',
      activeSpecialistId: 'dietista',
      specialistName: 'Dietista',
      specialistDomains: ['nutrition'],
      stateSnapshot: expect.objectContaining({
        leadDomain: 'nutrition',
      }),
    })
  })

  it('uses the current speaking specialist label for the assistant message even when the lead panel lags behind', async () => {
    prismaMock.caseState.findUnique.mockResolvedValue(null)

    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'health',
        finalMessageMarkdown: 'Il Fisioterapista è qui disponibile per approfondire la spalla.',
        toolCallsToExecute: [],
        stateSnapshot: {
          schemaVersion: 1,
          conversationId: 'conv-db-1',
          activeDomains: ['health', 'training'],
          domainPanels: [
            {
              domain: 'health',
              selectedAgentId: 'mmg',
              candidateAgentIds: ['mmg'],
              status: 'active',
              priorityScore: 0.9,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
            {
              domain: 'training',
              selectedAgentId: 'fisioterapista',
              candidateAgentIds: ['fisioterapista'],
              status: 'monitoring',
              priorityScore: 0.7,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
          ],
          leadDomain: 'health',
          speakerPolicy: 'lead',
          conversationFocus: {
            activeProblems: ['spalla sinistra debole'],
            activeGoals: ['ricomposizione corporea'],
            activeConstraints: [],
            summary: 'speaker mismatch guard',
          },
          coordinationState: {
            crossDomainConflicts: [],
            dependencies: [],
            needsReview: false,
          },
          sharedOpenQuestions: [],
          domainOpenQuestions: {},
          updatedAt: '2026-03-27T20:40:00.000Z',
        },
        caseState: undefined,
        protocolEvents: [],
        activeSpecialist: {
          id: 'fisioterapista',
          displayName: 'Fisioterapista',
          domain: 'training',
          domains: ['training', 'health'],
        },
        ui: { domainIcon: 'health', moodScore: 50, sectionScores: { health: 60, general: 50 } },
        safety: { escalation: 'none' },
        debug: { selectedAgents: ['fisioterapista', 'mmg'], conflicts: [] },
      })),
    }))

    const { POST } = await import('@/app/api/chat/send/route')

    const res = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u-db',
        },
        body: JSON.stringify({ message: 'va bene, procediamo' }),
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.text()
    const uiState = extractSseEvent(body, 'ui.state')

    expect(uiState).toMatchObject({
      domain: 'health',
      specialistName: 'Fisioterapista',
    })
    expect(prismaMock.message.create.mock.calls[1]?.[0]).toMatchObject({
      data: expect.objectContaining({
        role: 'assistant',
        specialistName: 'Fisioterapista',
      }),
    })
  })

  it('routes text tool calls through the matching panel agent instead of one global capability agent', async () => {
    prismaMock.caseState.findUnique.mockResolvedValue(null)

    const executeToolCallMock = vi.fn(async (call) => ({
      toolCallId: call.id,
      ok: true,
    }))

    vi.resetModules()
    vi.doMock('@/lib/ai/team/loader', () => ({
      loadTeam: vi.fn(() => [
        {
          id: 'medico',
          displayName: 'Medico',
          domainTags: ['health'],
          systemPrompt: 'health',
          toolsAllowed: ['health.addMetric'],
          decisionStyle: 'team-led',
        },
        {
          id: 'dietista',
          displayName: 'Dietista',
          domainTags: ['nutrition'],
          systemPrompt: 'nutrition',
          toolsAllowed: ['user.setAttribute'],
          decisionStyle: 'team-led',
        },
      ]),
    }))
    vi.doMock('@/lib/tools/toolExecutor', async () => {
      const actual = await vi.importActual<typeof import('@/lib/tools/toolExecutor')>(
        '@/lib/tools/toolExecutor',
      )
      return {
        ...actual,
        createToolExecutor: vi.fn(() => ({
          executeToolCall: executeToolCallMock,
        })),
      }
    })
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'general',
        finalMessageMarkdown: 'ok',
        toolCallsToExecute: [
          { id: 'call-health', name: 'health.addMetric', args: { metricType: 'pain', value: 7 } },
          {
            id: 'call-nutrition',
            name: 'user.setAttribute',
            args: { domain: 'nutrition', key: 'food_triggers', value: 'latticini' },
          },
        ],
        stateSnapshot: {
          schemaVersion: 1,
          conversationId: 'conv-db-1',
          activeDomains: ['health', 'nutrition'],
          domainPanels: [
            {
              domain: 'health',
              selectedAgentId: 'medico',
              candidateAgentIds: ['medico'],
              status: 'active',
              priorityScore: 0.9,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
            {
              domain: 'nutrition',
              selectedAgentId: 'dietista',
              candidateAgentIds: ['dietista'],
              status: 'active',
              priorityScore: 0.8,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
          ],
          leadDomain: 'health',
          speakerPolicy: 'lead',
          conversationFocus: {
            activeProblems: ['dolore e gonfiore'],
            activeGoals: ['stare meglio'],
            activeConstraints: [],
            summary: 'multi-domain',
          },
          coordinationState: {
            crossDomainConflicts: [],
            dependencies: [],
            needsReview: false,
          },
          sharedOpenQuestions: [],
          domainOpenQuestions: {},
          updatedAt: '2026-03-27T12:00:00.000Z',
        },
        protocolEvents: [],
        activeSpecialist: null,
        ui: { domainIcon: 'general', moodScore: 50, sectionScores: { general: 50 } },
        safety: { escalation: 'none' },
        debug: { selectedAgents: ['medico'], conflicts: [] },
      })),
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const res = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u-db',
        },
        body: JSON.stringify({ message: 'dolore e gonfiore dopo i pasti' }),
      }),
    )

    expect(res.status).toBe(200)
    await res.text()

    expect(executeToolCallMock).toHaveBeenCalledTimes(2)
    expect(executeToolCallMock.mock.calls[0]?.[1]).toMatchObject({
      agent: { id: 'medico', toolsAllowed: ['health.addMetric'] },
    })
    expect(executeToolCallMock.mock.calls[1]?.[1]).toMatchObject({
      agent: { id: 'dietista', toolsAllowed: ['user.setAttribute'] },
    })
  })

  it('smoke: /api/chat/send back-pain request persists AgentWorkspace proposals', async () => {
    vi.resetModules()
    vi.doUnmock('@/lib/ai/orchestrator/orchestrator')
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
    // Consume stream so all async persistence calls inside ReadableStream.start() complete
    await res.text()

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

  it('persists canonical CaseState when orchestrator returns it', async () => {
    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'nutrition',
        finalMessageMarkdown: 'Ti risponde temporaneamente il Fisioterapista.',
        toolCallsToExecute: [],
        activeSpecialist: {
          id: 'fisioterapista',
          displayName: 'Fisioterapista',
          domain: 'training',
          domains: ['training', 'health'],
        },
        caseState: {
          conversationId: 'conv-db-1',
          ownerAgentId: 'dietista',
          activeSpeakerAgentId: 'fisioterapista',
          protocolState: 'consult_active_takeover',
          consultTargetAgentId: 'fisioterapista',
          returnTargetAgentId: 'dietista',
          consultReason: 'user_requested_specialist',
          takeoverTurns: 1,
          loopCount: 1,
          handoffCount: 0,
        },
        protocolEvents: [
          { kind: 'consult_requested', actorAgentId: 'dietista', toAgentId: 'fisioterapista' },
          { kind: 'takeover_started', fromAgentId: 'dietista', toAgentId: 'fisioterapista' },
        ],
        ui: { domainIcon: 'training', moodScore: 50, sectionScores: { training: 60, general: 50 } },
        safety: { escalation: 'none' },
        debug: { selectedAgents: ['dietista', 'fisioterapista'], conflicts: [] },
      })),
    }))

    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'voglio parlare con il fisioterapista' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await res.text()

    expect(prismaMock.caseState.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.caseState.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { conversationId: expect.any(String) },
      create: {
        userId: 'u-db',
        ownerAgentId: 'fisioterapista',
        activeSpeakerAgentId: 'fisioterapista',
        protocolState: 'consult_active_takeover',
      },
      update: {
        ownerAgentId: 'fisioterapista',
        activeSpeakerAgentId: 'fisioterapista',
        protocolState: 'consult_active_takeover',
      },
    })
  })

  it('prioritizes protocol agent.thinking events over proposal-only theatrical steps', async () => {
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
        protocolEvents: [
          { kind: 'consult_requested', actorAgentId: 'dietista', toAgentId: 'fisioterapista' },
          { kind: 'takeover_started', fromAgentId: 'dietista', toAgentId: 'fisioterapista' },
        ],
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
    expect(body).toContain('consulto richiesto a Fisioterapista')
    expect(body).toContain('prendo temporaneamente il testimone')
    expect(body).not.toContain('Valuto pattern del dolore')
    expect(body).not.toContain('Escludo red flags cliniche')
    expect(body).toContain('"type":"message.complete"')
  })

  it('emits immediate thinking events for multi-domain messages using accurate routing', async () => {
    vi.resetModules()
    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: vi.fn(async () => ({
        domain: 'general',
        finalMessageMarkdown: 'Prima raccolgo meglio il contesto.',
        toolCallsToExecute: [],
        protocolEvents: [],
        ui: { domainIcon: 'general', moodScore: 50, sectionScores: { general: 50 } },
        safety: { escalation: 'none' },
        debug: { selectedAgents: [], conflicts: [] },
      })),
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({ message: 'mi alleno male, ho ansia e dolore' }),
    })

    const res = await POST(req)
    const body = await res.text()

    expect(res.status).toBe(200)
    // With accurate routing, multi-domain messages now correctly show thinking events
    expect(body).toContain('"type":"agent.thinking"')
    expect(body).toContain('"type":"message.complete"')
  })

  it('ignores legacy activeSpecialistId in request body and relies on canonical case state only', async () => {
    vi.resetModules()
    const orchestrateMock = vi.fn(async (_deps, input) => ({
      domain: 'general',
      finalMessageMarkdown: 'ok',
      toolCallsToExecute: [],
      caseState: input.caseState ?? undefined,
      protocolEvents: [],
      ui: { domainIcon: 'general', moodScore: 50, sectionScores: { general: 50 } },
      safety: { escalation: 'none' },
      debug: { selectedAgents: [], conflicts: [] },
    }))

    vi.doMock('@/lib/ai/orchestrator/orchestrator', () => ({
      orchestrate: orchestrateMock,
    }))
    const { POST } = await import('@/app/api/chat/send/route')

    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u-db',
      },
      body: JSON.stringify({
        message: 'ciao',
        activeSpecialistId: 'fisioterapista',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await res.text()

    expect(orchestrateMock).toHaveBeenCalledTimes(1)
    expect(orchestrateMock.mock.calls[0]?.[1]).not.toHaveProperty('activeSpecialistId')
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
