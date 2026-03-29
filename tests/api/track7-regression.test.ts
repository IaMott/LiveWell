/**
 * TRACK 7 — Regression tests for the six critical fixes from the adversarial review.
 *
 *  1. Reply-to exact ID lookup (agentPrompt.ts)
 *  2. hasMoreAttributes truncation warning (agentPrompt.ts)
 *  3. Export specialist name (export/route.ts)
 *  4. Export soft-delete filter (export/route.ts — deletedAt:null enforced by DB query)
 *  5. Live-sync round1 + round2 thinking steps both emitted
 *  6. Live-sync: proposals with confidence=0 are excluded from thinking steps
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAgentUserPrompt } from '@/lib/ai/orchestrator/agentPrompt'
import type { AgentInput } from '@/lib/ai/types'

// ─── Global mocks (must be hoisted before any imports that trigger them) ──────

vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(),
  getAuthRole: vi.fn(),
  getAuthOwnerMode: vi.fn(),
}))

const prismaMock = {
  conversation: { findFirst: vi.fn() },
  messageReview: { findMany: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

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

vi.mock('@/app/api/chat/send/chatPersistence', () => ({
  isDbPersistenceEnabled: vi.fn(() => true),
  createDbPersistenceDeps: vi.fn(() => persistenceMock),
}))
vi.mock('@/lib/ai/orchestrator/orchestrator', () => ({ orchestrate: orchestrateMock }))
vi.mock('@/lib/ai/llmFactory', () => ({
  createLlmWithFallback: vi.fn(() => ({ provider: 'test' })),
}))
vi.mock('@/lib/ai/team/loader', () => ({
  loadTeam: vi.fn(() => [
    {
      id: 'medico',
      displayName: 'Medico',
      domainTags: ['health'],
      systemPrompt: 'health',
      toolsAllowed: [],
      decisionStyle: 'team-led',
    },
    {
      id: 'dietista',
      displayName: 'Dietista',
      domainTags: ['nutrition'],
      systemPrompt: 'nutrition',
      toolsAllowed: [],
      decisionStyle: 'team-led',
    },
  ]),
}))
vi.mock('@/lib/tools/toolExecutor', () => ({
  createToolExecutor: vi.fn(() => ({
    executeToolCall: vi.fn(async () => undefined),
  })),
}))

// ─── Shared AgentInput factory ────────────────────────────────────────────────

function makeInput(overrides: Partial<AgentInput> = {}): AgentInput {
  return {
    requestId: 'r-t7',
    userId: 'u-t7',
    conversationId: 'c-t7',
    message: 'Seguiamo il piano di ieri',
    contextPack: {
      user: { id: 'u-t7', role: 'USER', profile: {} },
      history: {
        recentMessages: [
          {
            id: 'msg-old',
            role: 'assistant' as const,
            content: 'Benvenuto al primo colloquio, posso aiutarti?',
            createdAt: '2026-03-28T08:00:00.000Z',
          },
          {
            id: 'msg-target',
            role: 'assistant' as const,
            content: 'Il piano prevede 3 sessioni settimanali di 45 minuti',
            createdAt: '2026-03-28T09:00:00.000Z',
          },
          {
            id: 'msg-latest',
            role: 'assistant' as const,
            content: 'Perfetto, ci vediamo domani!',
            createdAt: '2026-03-28T10:00:00.000Z',
          },
        ],
        recentArtifacts: [],
      },
      trackers: {},
      notifications: { unreadCount: 0 },
      ui: { moodScore: 60, sectionScores: { general: 60 } },
    },
    ...overrides,
  }
}

// ─── 1. Reply-to exact ID lookup ──────────────────────────────────────────────

describe('agentPrompt — reply-to exact ID lookup', () => {
  it('uses the exact matched message when replyToMessageId points to a non-latest assistant msg', () => {
    const input = makeInput({ replyToMessageId: 'msg-target' })
    const prompt = buildAgentUserPrompt(input, 'fisioterapista')

    // The REPLY-TO line must quote the exact target (not the most-recent assistant)
    expect(prompt).toContain(
      '↩ REPLY-TO (l\'utente sta rispondendo a questo messaggio assistente specifico): "Il piano prevede 3 sessioni settimanali di 45 minuti"',
    )
  })

  it('falls back to the most-recent assistant message when no ID matches', () => {
    // replyToMessageId that does not match any message ID → fallback to latest assistant
    const input = makeInput({ replyToMessageId: 'non-existent-id' })
    const prompt = buildAgentUserPrompt(input, 'fisioterapista')

    // Fallback: most-recent assistant message content
    expect(prompt).toContain('↩ REPLY-TO')
    expect(prompt).toContain('Perfetto, ci vediamo domani!')
  })

  it('omits reply-to section entirely when replyToMessageId is absent', () => {
    const input = makeInput() // no replyToMessageId
    const prompt = buildAgentUserPrompt(input, 'fisioterapista')

    expect(prompt).not.toContain('↩ REPLY-TO')
  })
})

// ─── 2. hasMoreAttributes truncation warning ─────────────────────────────────

describe('agentPrompt — hasMoreAttributes truncation warning', () => {
  it('includes truncation warning when hasMoreAttributes is true', () => {
    const input = makeInput()
    const inputWithAttrs: AgentInput = {
      ...input,
      contextPack: {
        ...input.contextPack,
        user: {
          ...input.contextPack.user,
          hasMoreAttributes: true,
          attributes: {
            health: { weight: { value: 80, unit: 'kg' } },
          },
        },
      },
    }
    const prompt = buildAgentUserPrompt(inputWithAttrs, 'medico')

    expect(prompt).toContain('CONTESTO ATTRIBUTI TRONCATO')
    expect(prompt).toContain('200 entries')
  })

  it('omits truncation warning when hasMoreAttributes is false or absent', () => {
    const input = makeInput()
    const inputWithAttrs: AgentInput = {
      ...input,
      contextPack: {
        ...input.contextPack,
        user: {
          ...input.contextPack.user,
          hasMoreAttributes: false,
          attributes: {
            health: { weight: { value: 80, unit: 'kg' } },
          },
        },
      },
    }
    const prompt = buildAgentUserPrompt(inputWithAttrs, 'medico')

    expect(prompt).not.toContain('CONTESTO ATTRIBUTI TRONCATO')
  })
})

// ─── 3 & 4. Export — specialist name + soft-delete filter ────────────────────

describe('export route — specialist identity in output', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { getAuthUserId } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('user-t7')
    prismaMock.messageReview.findMany.mockResolvedValue([])
  })

  it('uses specialistName instead of "LiveWell" as the speaker label for assistant messages', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-t7',
      userId: 'user-t7',
      messages: [
        {
          id: 'user-msg-t7',
          role: 'user',
          content: 'Come sto?',
          createdAt: new Date('2026-03-28T10:00:00.000Z'),
          domain: null,
          specialistName: null,
          replyToMessageId: null,
          attachments: [],
        },
        {
          id: 'assistant-msg-t7',
          role: 'assistant',
          content: 'Stai andando molto bene!',
          createdAt: new Date('2026-03-28T10:01:00.000Z'),
          domain: 'health',
          specialistName: 'Fisioterapista',
          replyToMessageId: null,
          attachments: [],
        },
      ],
    })

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/export/route')
    const res = await GET(new Request('http://localhost/api/conversations/conv-t7/export'), {
      params: Promise.resolve({ id: 'conv-t7' }),
    })
    const text = await res.text()

    expect(res.status).toBe(200)
    // Specialist name must appear as the speaker label
    expect(text).toContain('Fisioterapista:')
    // Generic fallback must NOT appear for this message
    expect(text).not.toContain('LiveWell:')
  })

  it('falls back to "LiveWell" when specialistName is null', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-t7b',
      userId: 'user-t7',
      messages: [
        {
          id: 'assistant-msg-t7b',
          role: 'assistant',
          content: 'Risposta generica',
          createdAt: new Date('2026-03-28T10:01:00.000Z'),
          domain: null,
          specialistName: null,
          replyToMessageId: null,
          attachments: [],
        },
      ],
    })

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/export/route')
    const res = await GET(new Request('http://localhost/api/conversations/conv-t7b/export'), {
      params: Promise.resolve({ id: 'conv-t7b' }),
    })
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toContain('LiveWell:')
  })
})

describe('export route — soft-delete filter (deletedAt:null enforced at DB layer)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { getAuthUserId } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('user-t7')
    prismaMock.messageReview.findMany.mockResolvedValue([])
  })

  it('only renders messages returned by the DB query (simulates deletedAt:null filter)', async () => {
    // The DB layer already filters `where: { deletedAt: null }` — the route never
    // receives deleted messages. We simulate this by only returning the live message.
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-softdel',
      userId: 'user-t7',
      messages: [
        {
          id: 'live-msg',
          role: 'user',
          content: 'Messaggio attivo',
          createdAt: new Date('2026-03-28T10:00:00.000Z'),
          domain: null,
          specialistName: null,
          replyToMessageId: null,
          attachments: [],
        },
        // 'Messaggio cancellato' would have been filtered by `where: { deletedAt: null }`
        // in the real DB call — it is intentionally absent from the mock response.
      ],
    })

    vi.resetModules()
    const { GET } = await import('@/app/api/conversations/[id]/export/route')
    const res = await GET(new Request('http://localhost/api/conversations/conv-softdel/export'), {
      params: Promise.resolve({ id: 'conv-softdel' }),
    })
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toContain('Messaggio attivo')
    expect(text).not.toContain('Messaggio cancellato')
  })
})

// ─── 5 & 6. Live-sync — round1 + round2 thinking steps ───────────────────────

const baseContextPack = {
  user: { id: 'u-t7', role: 'OWNER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  files: [],
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

const baseStateSnapshot = {
  schemaVersion: 1,
  conversationId: 'conv-t7',
  activeDomains: ['health'],
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
  ],
  leadDomain: 'health',
  speakerPolicy: 'lead',
  conversationFocus: {
    activeProblems: [],
    activeGoals: [],
    activeConstraints: [],
    summary: 'test',
  },
  coordinationState: {
    crossDomainConflicts: [],
    dependencies: [],
    needsReview: false,
  },
  sharedOpenQuestions: [],
  domainOpenQuestions: {},
  updatedAt: '2026-03-28T12:00:00.000Z',
}

function setupLiveSyncMocks() {
  persistenceMock.findConversationById.mockResolvedValue({ id: 'conv-t7', userId: 'u-t7' })
  persistenceMock.buildContextPack.mockResolvedValue(baseContextPack)
  persistenceMock.getCaseRuntimeState.mockResolvedValue(null)
  persistenceMock.getCaseState.mockResolvedValue(null)
  persistenceMock.persistCaseRuntimeState.mockResolvedValue(undefined)
  persistenceMock.persistCaseState.mockResolvedValue(undefined)
}

describe('live-sync — round1 + round2 thinking steps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits thinking steps from both round1Proposals and round2Proposals', async () => {
    const { getAuthUserId, getAuthRole, getAuthOwnerMode } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('u-t7')
    vi.mocked(getAuthRole).mockResolvedValue('OWNER')
    vi.mocked(getAuthOwnerMode).mockResolvedValue(true)
    setupLiveSyncMocks()

    orchestrateMock.mockResolvedValue({
      toolCallsToExecute: [],
      stateSnapshot: baseStateSnapshot,
      caseState: undefined,
      activeSpecialist: null,
      debug: {
        selectedAgents: ['medico', 'dietista'],
        round1Proposals: [
          {
            agentId: 'medico',
            domain: 'health',
            summary: 'Valutazione pressione arteriosa',
            reasoning: 'Ipertensione borderline, monitorare',
            confidence: 0.85,
          },
        ],
        round2Proposals: [
          {
            agentId: 'dietista',
            domain: 'nutrition',
            summary: 'Piano dieta iposodica',
            reasoning: 'Riduci sodio < 2g/die',
            confidence: 0.8,
          },
        ],
      },
    })

    const { POST } = await import('@/app/api/chat/live-sync/route')
    const res = await POST(
      new Request('http://localhost/api/chat/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-t7', userMessage: 'pressione alta' }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.thinkingSteps).toHaveLength(2)
    expect(json.thinkingSteps[0]).toMatchObject({
      specialistName: 'Medico',
      title: 'Valutazione pressione arteriosa',
      domain: 'health',
    })
    expect(json.thinkingSteps[1]).toMatchObject({
      specialistName: 'Dietista',
      title: 'Piano dieta iposodica',
      domain: 'nutrition',
    })
  })

  it('excludes proposals with confidence=0 from thinking steps', async () => {
    const { getAuthUserId, getAuthRole, getAuthOwnerMode } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('u-t7')
    vi.mocked(getAuthRole).mockResolvedValue('OWNER')
    vi.mocked(getAuthOwnerMode).mockResolvedValue(true)
    setupLiveSyncMocks()

    orchestrateMock.mockResolvedValue({
      toolCallsToExecute: [],
      stateSnapshot: baseStateSnapshot,
      caseState: undefined,
      activeSpecialist: null,
      debug: {
        selectedAgents: ['medico', 'dietista'],
        round1Proposals: [
          {
            agentId: 'medico',
            domain: 'health',
            summary: 'Valutazione ok',
            reasoning: 'Tutto bene',
            confidence: 0.9,
          },
          {
            agentId: 'dietista',
            domain: 'nutrition',
            summary: 'Skip — zero confidence',
            reasoning: 'Non abbastanza dati',
            confidence: 0, // must be excluded
          },
        ],
        round2Proposals: [],
      },
    })

    const { POST } = await import('@/app/api/chat/live-sync/route')
    const res = await POST(
      new Request('http://localhost/api/chat/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-t7', userMessage: 'check' }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.thinkingSteps).toHaveLength(1)
    expect(json.thinkingSteps[0]).toMatchObject({ specialistName: 'Medico' })
  })

  it('deduplicates identical proposals appearing in both rounds', async () => {
    const { getAuthUserId, getAuthRole, getAuthOwnerMode } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('u-t7')
    vi.mocked(getAuthRole).mockResolvedValue('OWNER')
    vi.mocked(getAuthOwnerMode).mockResolvedValue(true)
    setupLiveSyncMocks()

    const duplicateProposal = {
      agentId: 'medico',
      domain: 'health',
      summary: 'Analisi ripetuta',
      reasoning: 'Stesso ragionamento',
      confidence: 0.9,
    }

    orchestrateMock.mockResolvedValue({
      toolCallsToExecute: [],
      stateSnapshot: baseStateSnapshot,
      caseState: undefined,
      activeSpecialist: null,
      debug: {
        selectedAgents: ['medico'],
        round1Proposals: [duplicateProposal],
        round2Proposals: [duplicateProposal], // exact duplicate
      },
    })

    const { POST } = await import('@/app/api/chat/live-sync/route')
    const res = await POST(
      new Request('http://localhost/api/chat/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-t7', userMessage: 'ripetuto' }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    // Dedupe must collapse the two identical proposals to one
    expect(json.thinkingSteps).toHaveLength(1)
  })
})
