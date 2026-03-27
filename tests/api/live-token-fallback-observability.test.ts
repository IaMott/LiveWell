import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetServerEnvForTests } from '@/lib/validators/env'

const logApiErrorEventMock = vi.fn(async () => undefined)
const prismaMock = {
  user: {
    findUnique: vi.fn(async () => {
      throw new Error('db down')
    }),
  },
  userProfile: { findUnique: vi.fn(async () => null) },
  message: { findMany: vi.fn(async () => []) },
  workoutSession: { findMany: vi.fn(async () => []) },
  meal: { findMany: vi.fn(async () => []) },
  mindfulnessEntry: { findMany: vi.fn(async () => []) },
  userAttribute: { findMany: vi.fn(async () => []) },
  fileAsset: { findMany: vi.fn(async () => []) },
  recommendationArtifact: { findMany: vi.fn(async () => []) },
  caseState: {
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
  },
}

vi.mock('@/lib/monitoring/apiErrorEvents', () => ({
  logApiErrorEvent: logApiErrorEventMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function MockGoogleGenAI() {
    return {
      authTokens: {
        create: vi.fn().mockResolvedValue({ name: 'auth_tokens/test-live-fallback-token' }),
      },
      tokens: undefined,
    }
  }),
}))

describe('/api/live-token fallback observability', () => {
  const oldEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...oldEnv }
    process.env.NODE_ENV = 'test'
    process.env.GEMINI_API_KEY = 'test-secret-key'
    process.env.LIVE_MODEL = 'gemini-2.0-flash-live-001'
    prismaMock.caseState.findUnique.mockResolvedValue(null)
    prismaMock.caseState.findFirst.mockResolvedValue(null)
    resetServerEnvForTests()
  })

  it('logs structured fallback when system instruction build fails', async () => {
    const { POST } = await import('@/app/api/live-token/route')

    const req = new Request('http://localhost/api/live-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u1',
      },
      body: JSON.stringify({ conversationId: 'c1' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.systemInstruction).toContain('Sei un assistente AI per la salute')

    expect(
      logApiErrorEventMock.mock.calls.some(
        (c) =>
          c[0]?.errorCode === 'FALLBACK_SYSTEM_INSTRUCTION' &&
          c[0]?.metadata?.fallbackPhase === 'SYSTEM_INSTRUCTION_BUILD',
      ),
    ).toBe(true)
  })

  it('returns canonical stateSnapshot from live bootstrap when persisted snapshot is available', async () => {
    prismaMock.caseState.findUnique.mockResolvedValue({
      conversationId: 'c1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'owner_active',
      stateSnapshot: {
        schemaVersion: 1,
        conversationId: 'c1',
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
        updatedAt: '2026-03-26T23:42:00.000Z',
      },
    })

    const { POST } = await import('@/app/api/live-token/route')

    const req = new Request('http://localhost/api/live-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u1',
      },
      body: JSON.stringify({ conversationId: 'c1' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.stateSnapshot).toMatchObject({
      leadDomain: 'nutrition',
      activeDomains: ['nutrition'],
    })
  })

  it('builds a context-rich systemInstruction from canonical snapshot, attributes and recent history', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ name: 'Alice' })
    prismaMock.userProfile.findUnique.mockResolvedValue({
      birthDate: new Date('1990-04-03T00:00:00.000Z'),
      gender: 'female',
      height: 168,
      weight: 62,
      health: { conditions: 'colon irritabile' },
      nutrition: { preferences: 'low FODMAP' },
      training: { frequency: 3 },
      mindfulness: null,
      goals: { objectives: 'ridurre gonfiore e migliorare energia' },
    })
    prismaMock.message.findMany.mockResolvedValue([
      {
        role: 'assistant',
        content: 'Ti suggerisco di osservare i latticini per una settimana.',
        createdAt: new Date('2026-03-27T08:00:00.000Z'),
      },
      {
        role: 'user',
        content: 'Dopo yogurt e latte ho molto gonfiore.',
        createdAt: new Date('2026-03-27T07:59:00.000Z'),
      },
    ])
    prismaMock.userAttribute.findMany.mockResolvedValue([
      {
        domain: 'nutrition',
        key: 'food_triggers',
        value: 'latticini',
        unit: null,
        recordedAt: new Date('2026-03-26T10:00:00.000Z'),
        notes: 'annotato dal dietista',
      },
      {
        domain: 'general',
        key: 'attachment_file',
        value: { fileAssetId: 'file-1' },
        unit: null,
        recordedAt: new Date('2026-03-26T11:00:00.000Z'),
        notes: 'referto caricato dal team salute',
      },
      {
        domain: 'nutrition',
        key: 'generated_artifact',
        value: { artifactId: 'artifact-1' },
        unit: null,
        recordedAt: new Date('2026-03-26T12:00:00.000Z'),
        notes: 'sintesi nutrizionale generata dal team',
      },
    ])
    prismaMock.fileAsset.findMany.mockResolvedValue([
      {
        id: 'file-1',
        filename: 'referto.pdf',
        mimeType: 'application/pdf',
        extractedText: 'RM lombare: protrusione L4-L5, ridurre i trigger meccanici.',
        createdAt: new Date('2026-03-26T11:00:00.000Z'),
      },
    ])
    prismaMock.recommendationArtifact.findMany.mockResolvedValue([
      {
        id: 'artifact-1',
        title: 'Piano alimentare',
        contentMarkdown: 'Riduci latticini per 7 giorni e monitora il gonfiore.',
        createdAt: new Date('2026-03-26T12:00:00.000Z'),
      },
    ])
    prismaMock.caseState.findUnique.mockResolvedValue({
      conversationId: 'c1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'owner_active',
      stateSnapshot: {
        schemaVersion: 1,
        conversationId: 'c1',
        activeDomains: ['nutrition', 'health'],
        domainPanels: [
          {
            domain: 'nutrition',
            selectedAgentId: 'dietista',
            candidateAgentIds: ['dietista', 'medico'],
            status: 'active',
            priorityScore: 9,
            lastReasoningAt: '2026-03-27T09:00:00.000Z',
            pendingNeeds: ['diario sintomi'],
          },
        ],
        leadDomain: 'nutrition',
        speakerPolicy: 'lead',
        conversationFocus: {
          activeProblems: ['gonfiore'],
          activeGoals: ['ridurre sintomi'],
          activeConstraints: ['evitare trigger alimentari'],
          summary: 'focus nutrizione',
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: ['monitorare sintomi post pasti'],
          needsReview: false,
        },
        sharedOpenQuestions: ['quali alimenti peggiorano i sintomi?'],
        domainOpenQuestions: { nutrition: ['latticini o frumento?'] },
        updatedAt: '2026-03-27T09:00:00.000Z',
      },
    })

    const { POST } = await import('@/app/api/live-token/route')

    const res = await POST(
      new Request('http://localhost/api/live-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u1',
        },
        body: JSON.stringify({ conversationId: 'c1' }),
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.systemInstruction).toContain('PANEL MULTI-DOMINIO ATTIVO PER QUESTA CONVERSAZIONE')
    expect(json.systemInstruction).toContain('leadDomain: nutrition')
    expect(json.systemInstruction).toContain('ATTRIBUTI REGISTRATI DAGLI AGENTI:')
    expect(json.systemInstruction).toContain('food_triggers: latticini')
    expect(json.systemInstruction).toContain('DOCUMENTI / ALLEGATI RECENTI:')
    expect(json.systemInstruction).toContain('referto.pdf')
    expect(json.systemInstruction).toContain('referto caricato dal team salute')
    expect(json.systemInstruction).toContain('ARTEFATTI GENERATI RECENTI:')
    expect(json.systemInstruction).toContain('Piano alimentare')
    expect(json.systemInstruction).toContain('sintesi nutrizionale generata dal team')
    expect(json.systemInstruction).toContain('CRONOLOGIA CHAT RECENTE')
    expect(json.systemInstruction).toContain('Utente: Dopo yogurt e latte ho molto gonfiore.')
    expect(json.systemInstruction).toContain(
      'Assistente: Ti suggerisco di osservare i latticini per una settimana.',
    )
    expect(json.stateSnapshot).toMatchObject({
      leadDomain: 'nutrition',
      activeDomains: ['nutrition', 'health'],
    })
  })
})
