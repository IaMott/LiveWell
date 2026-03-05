import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getProfileHistory } from '../src/app/api/profile/history/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}))

describe('/api/profile/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('restituisce 401 se utente non autenticato', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const response = await getProfileHistory(
      new Request('http://localhost/api/profile/history'),
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Non autenticato' })
  })

  it('restituisce 400 su query section invalida', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)

    const response = await getProfileHistory(
      new Request('http://localhost/api/profile/history?section=invalid'),
    )

    expect(response.status).toBe(400)
  })

  it('restituisce timeline aggregata con mapping allegati per sezione', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      health: {
        _history: [
          {
            syncId: 'h1',
            timestamp: '2026-03-04T10:00:00.000Z',
            domain: 'salute',
            primarySpecialist: 'mmg',
            contributors: ['mmg'],
            userMessage: 'Ho mal di schiena',
            assistantSummary: 'Valuta controllo specialistico',
            attachments: [{ fileName: 'referto.pdf', type: 'image' }],
          },
        ],
      },
      nutrition: {
        _history: [
          {
            syncId: 'n1',
            timestamp: '2026-03-05T10:00:00.000Z',
            domain: 'nutrizione',
            primarySpecialist: 'dietista',
            contributors: ['dietista'],
            userMessage: 'Vorrei migliorare colazione',
            assistantSummary: 'Aggiungi proteine e fibre',
            attachments: [],
          },
        ],
      },
      training: null,
      mindfulness: null,
      goals: null,
      settings: {
        attachmentBySection: {
          nutrition: [{ fileName: 'meal.jpg', type: 'image' }],
        },
      },
    } as never)

    const response = await getProfileHistory(
      new Request('http://localhost/api/profile/history?limit=10'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.timeline).toHaveLength(2)
    expect(body.timeline[0].section).toBe('nutrition')
    expect(body.timeline[1].section).toBe('health')
    expect(body.attachmentsBySection.nutrition).toEqual([
      { fileName: 'meal.jpg', type: 'image' },
    ])
  })

  it('filtra per sezione richiesta', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      health: {
        _history: [
          {
            syncId: 'h1',
            timestamp: '2026-03-04T10:00:00.000Z',
          },
        ],
      },
      nutrition: {
        _history: [
          {
            syncId: 'n1',
            timestamp: '2026-03-05T10:00:00.000Z',
          },
        ],
      },
      training: null,
      mindfulness: null,
      goals: null,
      settings: {},
    } as never)

    const response = await getProfileHistory(
      new Request('http://localhost/api/profile/history?section=health'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.timeline).toHaveLength(1)
    expect(body.timeline[0].section).toBe('health')
    expect(Object.keys(body.sectionHistory)).toEqual(['health'])
  })
})
