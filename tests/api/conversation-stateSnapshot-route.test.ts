import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  conversation: {
    findUnique: vi.fn(),
  },
  caseState: {
    findUnique: vi.fn(),
  },
}

vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/security/httpGuards', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

describe('/api/conversations/[id] stateSnapshot reload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns canonical stateSnapshot when persisted on caseState row', async () => {
    const { getAuthUserId } = await import('@/lib/auth')
    vi.mocked(getAuthUserId).mockResolvedValue('u1')

    prismaMock.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      title: 'Conv',
      userId: 'u1',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          content: 'ciao',
          domain: 'health',
          specialistName: 'Medico',
          createdAt: new Date('2026-03-26T20:00:00.000Z'),
        },
      ],
    })

    prismaMock.caseState.findUnique.mockResolvedValue({
      id: 'case-1',
      conversationId: 'conv-1',
      ownerAgentId: 'legacy-owner',
      activeSpeakerAgentId: 'legacy-speaker',
      protocolState: 'monitoring',
      stateSnapshot: {
        schemaVersion: 1,
        conversationId: 'conv-1',
        activeDomains: ['health', 'training'],
        domainPanels: [
          {
            domain: 'health',
            selectedAgentId: 'medico',
            candidateAgentIds: ['medico'],
            status: 'active',
            priorityScore: 0.9,
            lastReasoningAt: '2026-03-26T20:00:00.000Z',
            pendingNeeds: [],
          },
          {
            domain: 'training',
            selectedAgentId: 'fisioterapista',
            candidateAgentIds: ['fisioterapista'],
            status: 'monitoring',
            priorityScore: 0.4,
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
          summary: 'Quadro multi-dominio condiviso',
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: ['training-after-health'],
          needsReview: false,
        },
        sharedOpenQuestions: ['Da quanto tempo dura il dolore?'],
        domainOpenQuestions: {
          training: ['Ci sono limitazioni di movimento?'],
        },
        updatedAt: '2026-03-26T20:00:00.000Z',
      },
    })

    const { GET } = await import('@/app/api/conversations/[id]/route')

    const res = await GET(new Request('http://localhost/api/conversations/conv-1'), {
      params: Promise.resolve({ id: 'conv-1' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.stateSnapshot).toMatchObject({
      conversationId: 'conv-1',
      leadDomain: 'health',
      activeDomains: ['health', 'training'],
    })
    expect(json.stateSnapshot.domainPanels).toHaveLength(2)
    expect(json.messages).toHaveLength(1)
  })
})
