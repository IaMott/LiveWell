import { beforeEach, describe, expect, it, vi } from 'vitest'

const persistenceMock = {
  findConversationById: vi.fn(),
  buildContextPack: vi.fn(),
  getCaseState: vi.fn(),
  persistCaseState: vi.fn(),
  createConversation: vi.fn(),
  persistChatTurn: vi.fn(),
}

const orchestrateMock = vi.fn()

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
    executeToolCall: vi.fn(async () => undefined),
  })),
}))

describe('/api/chat/live-sync stateSnapshot response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns canonical stateSnapshot and persists a caseState derived from it', async () => {
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
    persistenceMock.getCaseState.mockResolvedValue(null)
    persistenceMock.persistCaseState.mockResolvedValue(undefined)

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
    expect(persistenceMock.persistCaseState).toHaveBeenCalledTimes(1)
    expect(persistenceMock.persistCaseState.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      conversationId: 'conv-1',
      caseState: expect.objectContaining({
        conversationId: 'conv-1',
        ownerAgentId: 'medico',
        activeSpeakerAgentId: 'medico',
      }),
    })
  })
})
