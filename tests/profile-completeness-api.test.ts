import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getProfileCompleteness } from '../src/app/api/profile/completeness/route'
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

describe('/api/profile/completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('restituisce 401 se non autenticato', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const response = await getProfileCompleteness(
      new Request('http://localhost/api/profile/completeness'),
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Non autenticato' })
  })

  it('restituisce 400 su query invalida', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)

    const response = await getProfileCompleteness(
      new Request('http://localhost/api/profile/completeness?section=invalid'),
    )

    expect(response.status).toBe(400)
  })

  it('calcola completezza 100% quando tutti i campi MVD sono presenti', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      birthDate: new Date('1990-01-10'),
      gender: 'M',
      height: 178,
      weight: 75,
      health: {
        conditions: 'nessuna',
        allergies: 'nessuna',
        medications: 'nessuna',
        bloodType: 'A+',
        notes: 'ok',
      },
      nutrition: {
        dietType: 'mediterranea',
        intolerances: 'nessuna',
        preferences: 'pesce',
        caloricGoal: 2200,
        mealsPerDay: 4,
      },
      training: {
        fitnessLevel: 'intermedio',
        equipment: 'palestra',
        weeklyDays: 3,
        injuries: 'nessuna',
        sport: 'running',
      },
      mindfulness: {
        stressLevel: 'medio',
        meditationExp: 'base',
        techniques: 'respirazione',
        sleepHours: 7,
      },
      goals: {
        shortTerm: 'perdere 2kg',
        mediumTerm: 'migliorare forza',
        longTerm: 'stile di vita stabile',
      },
    } as never)

    const response = await getProfileCompleteness(
      new Request('http://localhost/api/profile/completeness'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.overallCompletion).toBe(100)
    expect(body.sections).toHaveLength(6)
    for (const section of body.sections as Array<{
      completion: number
      missingFields: string[]
      nextField: string | null
    }>) {
      expect(section.completion).toBe(100)
      expect(section.missingFields).toEqual([])
      expect(section.nextField).toBeNull()
    }
  })

  it('calcola campi mancanti e nextField su profilo incompleto', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      birthDate: null,
      gender: 'M',
      height: 178,
      weight: null,
      health: {
        conditions: '',
        allergies: 'pollini',
        medications: '',
        bloodType: '',
        notes: '',
      },
      nutrition: null,
      training: null,
      mindfulness: null,
      goals: null,
    } as never)

    const response = await getProfileCompleteness(
      new Request('http://localhost/api/profile/completeness?section=personal'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sections).toEqual([
      {
        section: 'personal',
        completion: 50,
        missingFields: ['birthDate', 'weight'],
        nextField: 'birthDate',
      },
    ])
    expect(body.overallCompletion).toBe(50)
  })

  it('usa fallback safe su dati legacy invalidi senza errore 500', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as never)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      birthDate: null,
      gender: null,
      height: null,
      weight: null,
      health: { bloodType: 'X+' },
      nutrition: 'legacy-invalid-json',
      training: 123,
      mindfulness: { sleepHours: 99 },
      goals: { shortTerm: '' },
    } as never)

    const response = await getProfileCompleteness(
      new Request('http://localhost/api/profile/completeness?section=nutrition'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sections).toEqual([
      {
        section: 'nutrition',
        completion: 0,
        missingFields: ['dietType', 'intolerances', 'preferences', 'caloricGoal', 'mealsPerDay'],
        nextField: 'dietType',
      },
    ])
    expect(body.overallCompletion).toBe(0)
  })
})
