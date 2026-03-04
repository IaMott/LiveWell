import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getProfile, PUT as putProfile } from '../src/app/api/profile/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, resetAt: Date.now() })),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429 })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

describe('/api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimit).mockReturnValue({ success: true, resetAt: Date.now() })
  })

  it('GET restituisce 401 se non autenticato', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const response = await getProfile()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Non autenticato' })
  })

  it('GET normalizza sezioni JSON del profilo', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      birthDate: null,
      gender: 'M',
      height: 180,
      weight: 80,
      health: { allergies: 'pollini' },
      nutrition: null,
      training: null,
      mindfulness: null,
      goals: null,
      settings: null,
    } as never)

    const response = await getProfile()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.profile.health.allergies).toBe('pollini')
    expect(body.profile.nutrition.mealsPerDay).toBe('3')
    expect(body.profile.settings.theme).toBe('system')
  })

  it('GET non fallisce su payload legacy invalido e applica fallback sicuro', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      birthDate: null,
      gender: 'M',
      height: 180,
      weight: 80,
      health: null,
      nutrition: null,
      training: null,
      mindfulness: null,
      goals: null,
      settings: { notifications: 'si', theme: 'custom' },
    } as never)

    const response = await getProfile()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.profile.settings).toEqual({
      notifications: true,
      theme: 'system',
      language: 'it',
    })
  })

  it('PUT restituisce 400 su body non JSON', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      body: 'plain-text',
      headers: { 'Content-Type': 'text/plain' },
    })

    const response = await putProfile(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Body JSON non valido' })
  })

  it('PUT restituisce 400 su sezione non valida', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'unknown', data: {} }),
    })

    const response = await putProfile(request)

    expect(response.status).toBe(400)
    expect(prisma.userProfile.upsert).not.toHaveBeenCalled()
  })

  it('PUT restituisce 400 su data non conforme alla sezione', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'training', data: { weeklyDays: 12 } }),
    })

    const response = await putProfile(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Dati sezione non validi' })
    expect(prisma.userProfile.upsert).not.toHaveBeenCalled()
  })

  it('PUT aggiorna personal e nome utente con validatori condivisi', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({ id: 'p1' } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'personal',
        data: {
          name: 'Mario Rossi',
          birthDate: '1990-01-10',
          gender: 'M',
          height: 175,
          weight: 76,
        },
      }),
    })

    const response = await putProfile(request)

    expect(response.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'Mario Rossi' },
    })
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        update: expect.objectContaining({
          gender: 'M',
          height: 175,
          weight: 76,
          birthDate: new Date('1990-01-10'),
        }),
      }),
    )
  })

  it('PUT aggiorna sezione JSON validata', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({ id: 'p1' } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'nutrition',
        data: {
          dietType: 'mediterranea',
          caloricGoal: 2100,
          mealsPerDay: 4,
        },
      }),
    })

    const response = await putProfile(request)

    expect(response.status).toBe(200)
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          nutrition: {
            dietType: 'mediterranea',
            intolerances: '',
            preferences: '',
            caloricGoal: 2100,
            mealsPerDay: 4,
          },
        }),
      }),
    )
  })

  it('PUT settings preserva metadati AI interni esistenti', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      settings: {
        notifications: true,
        theme: 'system',
        language: 'it',
        aiAuditLog: [{ id: 'a1' }],
        aiSyncLedger: ['sync-1'],
      },
    } as never)
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({ id: 'p1' } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'settings',
        data: {
          notifications: false,
          theme: 'dark',
          language: 'en',
        },
      }),
    })

    const response = await putProfile(request)

    expect(response.status).toBe(200)
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          settings: {
            notifications: false,
            theme: 'dark',
            language: 'en',
            aiAuditLog: [{ id: 'a1' }],
            aiSyncLedger: ['sync-1'],
          },
        }),
      }),
    )
  })

  it('PUT settings ignora payload malevolo su chiavi tecniche', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      settings: {
        notifications: true,
        theme: 'system',
        language: 'it',
        aiAuditLog: [{ id: 'safe' }],
        aiSyncLedger: ['sync-safe'],
        attachmentHistory: [{ fileName: 'old.png' }],
      },
    } as never)
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({ id: 'p1' } as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'settings',
        data: {
          notifications: false,
          theme: 'dark',
          language: 'en',
          aiAuditLog: [{ id: 'hacked' }],
          aiSyncLedger: ['sync-hacked'],
          attachmentHistory: [{ fileName: 'hacked.png' }],
        },
      }),
    })

    const response = await putProfile(request)

    expect(response.status).toBe(200)
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          settings: {
            notifications: false,
            theme: 'dark',
            language: 'en',
            aiAuditLog: [{ id: 'safe' }],
            aiSyncLedger: ['sync-safe'],
            attachmentHistory: [{ fileName: 'old.png' }],
          },
        }),
      }),
    )
  })

  it('PUT restituisce 401 se non autenticato', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'health', data: {} }),
    })

    const response = await putProfile(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Non autenticato' })
  })
})
