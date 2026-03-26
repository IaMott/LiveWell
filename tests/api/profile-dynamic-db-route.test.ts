import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  user: { findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  userAttribute: { findMany: vi.fn() },
  fileAsset: { findMany: vi.fn() },
  recommendationArtifact: { findMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn(async () => 'u-test'),
}))
vi.mock('@/lib/security/httpGuards', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

describe('/api/profile/dynamic-db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-test',
      name: 'User Test',
      email: 'u@test.local',
      createdAt: new Date('2026-03-11T00:00:00Z'),
    })
    prismaMock.userProfile.findUnique.mockResolvedValue({
      birthDate: new Date('1991-06-26T00:00:00Z'),
      gender: 'M',
      height: 168,
      weight: 89,
      updatedAt: new Date('2026-03-11T10:00:00Z'),
    })
    prismaMock.userAttribute.findMany.mockResolvedValue([
      {
        id: 'a1',
        domain: 'personal',
        key: 'birthDate',
        value: '1991-06-26',
        unit: null,
        source: 'agent',
        conversationId: 'c1',
        recordedAt: new Date('2026-03-11T10:00:00Z'),
        validUntil: null,
        notes: null,
        createdAt: new Date('2026-03-11T10:00:00Z'),
      },
    ])
    prismaMock.fileAsset.findMany.mockResolvedValue([
      {
        id: 'f1',
        filename: 'referto.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: 'data:application/pdf;base64,abc',
        extractedText: 'referto sintetico',
        conversationId: 'c1',
        createdAt: new Date('2026-03-11T10:00:00Z'),
      },
    ])
    prismaMock.recommendationArtifact.findMany.mockResolvedValue([
      {
        id: 'ra1',
        type: 'nutrition',
        title: 'Piano alimentare',
        contentMarkdown: 'contenuto piano',
        relatedConversationId: 'c1',
        createdAt: new Date('2026-03-11T10:05:00Z'),
      },
    ])
  })

  it('exports profile snapshot + clinical dynamic DB payload without chat/workspace fragments', async () => {
    const { GET } = await import('@/app/api/profile/dynamic-db/route')
    const res = await GET(new Request('http://localhost/api/profile/dynamic-db'))
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      profile: { birthDate: string }
      dynamicDb: {
        schemaVersion: string
        attributes: Array<{ key: string }>
        domains: Record<string, Record<string, { current: { value: unknown } }>>
        derived: { currentAge?: { value: number } }
        documents: {
          userFiles: Array<{ id: string; notes: string }>
          generatedArtifacts: Array<{ id: string; notes: string }>
        }
      }
    }
    expect(json.profile.birthDate).toBe('1991-06-26T00:00:00.000Z')
    expect(json.dynamicDb.attributes[0]?.key).toBe('birthDate')
    expect(json.dynamicDb.schemaVersion).toBe('clinical-record-v2')
    expect(json.dynamicDb.domains.personal.birthDate.current.value).toBe('1991-06-26')
    expect(json.dynamicDb.derived.currentAge?.value).toBeTypeOf('number')
    expect(json.dynamicDb.documents.userFiles[0]?.id).toBe('f1')
    expect(json.dynamicDb.documents.generatedArtifacts[0]?.id).toBe('ra1')
    expect(JSON.stringify(json)).not.toContain('round1Proposal')
    expect(JSON.stringify(json)).not.toContain('round2Proposal')
  })
})
