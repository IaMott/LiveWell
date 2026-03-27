import { beforeEach, describe, expect, it, vi } from 'vitest'

const persistenceMock = {
  findConversationById: vi.fn(),
  buildContextPack: vi.fn(),
  getCaseRuntimeState: vi.fn(),
  getCaseState: vi.fn(),
  persistCaseRuntimeState: vi.fn(),
  persistCaseState: vi.fn(),
  createConversation: vi.fn(),
  persistChatTurn: vi.fn(),
}

const orchestrateMock = vi.fn()
const executeToolCallMock = vi.fn(async () => undefined)

vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(),
  getAuthRole: vi.fn(),
  getAuthOwnerMode: vi.fn(),
}))

vi.mock('@/app/api/chat/send/chatPersistence', () => ({
  isDbPersistenceEnabled: vi.fn(() => true),
  createDbPersistenceDeps: vi.fn(() => persistenceMock),
}))

vi.mock('@/lib/ai/orchestrator/orchestrator', () => ({
  orchestrate: orchestrateMock,
}))

vi.mock('@/lib/ai/llmFactory', () => ({
  createLlmWithFallback: vi.fn(() => ({ provider: 'test' })),
}))

vi.mock('@/lib/ai/team/loader', () => ({
  loadTeam: vi.fn(() => []),
}))

vi.mock('@/lib/tools/toolExecutor', () => ({
  createToolExecutor: vi.fn(() => ({
    executeToolCall: executeToolCallMock,
  })),
}))

describe('/api/chat/live-sync stateSnapshot response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns canonical stateSnapshot and persists the canonical runtime payload when snapshot is available', async () => {
    const { getAuthUserId, getAuthRole, getAuthOwnerMode } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('u1')
    vi.mocked(getAuthRole).mockResolvedValue('OWNER')
    vi.mocked(getAuthOwnerMode).mockResolvedValue(true)

    persistenceMock.findConversationById.mockResolvedValue({ id: 'conv-1', userId: 'u1' })
    persistenceMock.buildContextPack.mockResolvedValue({
      user: { id: 'u1', role: 'OWNER', profile: {} },
      history: { recentMessages: [], recentArtifacts: [] },
      trackers: {},
      notifications: { unreadCount: 0 },
      files: [],
      ui: { moodScore: 50, sectionScores: { general: 50 } },
    })
    persistenceMock.getCaseRuntimeState.mockResolvedValue(null)
    persistenceMock.getCaseState.mockResolvedValue(null)
    persistenceMock.persistCaseRuntimeState.mockResolvedValue(undefined)
    persistenceMock.persistCaseState.mockResolvedValue(undefined)
    executeToolCallMock.mockClear()

    const snapshot = {
      schemaVersion: 1,
      conversationId: 'conv-1',
      activeDomains: ['health', 'training'],
      domainPanels: [
        {
          domain: 'health',
          selectedAgentId: 'medico',
          candidateAgentIds: ['medico'],
          status: 'active',
          priorityScore: 0.91,
          lastReasoningAt: '2026-03-26T20:00:00.000Z',
          pendingNeeds: [],
        },
        {
          domain: 'training',
          selectedAgentId: 'fisioterapista',
          candidateAgentIds: ['fisioterapista'],
          status: 'monitoring',
          priorityScore: 0.44,
          lastReasoningAt: null,
          pendingNeeds: ['range-of-motion'],
        },
      ],
      leadDomain: 'health',
      speakerPolicy: 'lead',
      conversationFocus: {
        activeProblems: ['dolore cervicale'],
        activeGoals: ['ridurre il dolore'],
        activeConstraints: [],
        summary: 'Caso condiviso',
      },
      coordinationState: {
        crossDomainConflicts: [],
        dependencies: [],
        needsReview: false,
      },
      sharedOpenQuestions: [],
      domainOpenQuestions: { training: ['mobilita cervicale?'] },
      updatedAt: '2026-03-26T20:00:00.000Z',
    }

    orchestrateMock.mockResolvedValue({
      toolCallsToExecute: [],
      stateSnapshot: snapshot,
      caseState: undefined,
      activeSpecialist: null,
      debug: { selectedAgents: ['medico'] },
    })

    const { POST } = await import('@/app/api/chat/live-sync/route')

    const res = await POST(
      new Request('http://localhost/api/chat/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-1', userMessage: 'ho dolore al collo' }),
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      stateSnapshot: {
        conversationId: 'conv-1',
        leadDomain: 'health',
        activeDomains: ['health', 'training'],
      },
    })
    expect(persistenceMock.persistCaseRuntimeState).toHaveBeenCalledTimes(1)
    expect(persistenceMock.persistCaseRuntimeState.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      conversationId: 'conv-1',
      caseState: expect.objectContaining({
        conversationId: 'conv-1',
        leadDomain: 'health',
        activeDomains: ['health', 'training'],
      }),
    })
    expect(persistenceMock.persistCaseState).not.toHaveBeenCalled()
  })

  it('routes live tool calls through the matching panel agent instead of one global capability agent', async () => {
    const { getAuthUserId, getAuthRole, getAuthOwnerMode } = await import('@/lib/auth')
    const { loadTeam } = await import('@/lib/ai/team/loader')
    vi.mocked(getAuthUserId).mockResolvedValue('u1')
    vi.mocked(getAuthRole).mockResolvedValue('OWNER')
    vi.mocked(getAuthOwnerMode).mockResolvedValue(true)
    vi.mocked(loadTeam).mockReturnValue([
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
        toolsAllowed: ['nutrition.logMeal', 'user.setAttribute'],
        decisionStyle: 'team-led',
      },
    ])

    persistenceMock.findConversationById.mockResolvedValue({ id: 'conv-1', userId: 'u1' })
    persistenceMock.buildContextPack.mockResolvedValue({
      user: { id: 'u1', role: 'OWNER', profile: {} },
      history: { recentMessages: [], recentArtifacts: [] },
      trackers: {},
      notifications: { unreadCount: 0 },
      files: [],
      ui: { moodScore: 50, sectionScores: { general: 50 } },
    })
    persistenceMock.getCaseRuntimeState.mockResolvedValue({
      schemaVersion: 1,
      conversationId: 'conv-1',
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
      updatedAt: '2026-03-26T23:40:00.000Z',
    })
    persistenceMock.getCaseState.mockResolvedValue({
      conversationId: 'conv-1',
      ownerAgentId: 'medico',
      activeSpeakerAgentId: 'medico',
      protocolState: 'owner_active',
    })

    orchestrateMock.mockResolvedValue({
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
        conversationId: 'conv-1',
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
        updatedAt: '2026-03-26T23:40:00.000Z',
      },
      caseState: undefined,
      activeSpecialist: null,
      debug: { selectedAgents: ['medico'] },
    })

    const { POST } = await import('@/app/api/chat/live-sync/route')

    const res = await POST(
      new Request('http://localhost/api/chat/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-1', userMessage: 'dolore e gonfiore' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(executeToolCallMock).toHaveBeenCalledTimes(2)
    expect(executeToolCallMock.mock.calls[0]?.[1]?.agent).toMatchObject({ id: 'medico' })
    expect(executeToolCallMock.mock.calls[1]?.[1]?.agent).toMatchObject({ id: 'dietista' })
    expect(persistenceMock.persistCaseRuntimeState).toHaveBeenCalledTimes(1)
    expect(persistenceMock.persistCaseState).not.toHaveBeenCalled()
  })
})
