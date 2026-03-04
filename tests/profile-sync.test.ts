import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncProfileFromConversation } from '../src/lib/ai/profile-sync'
import { prisma } from '@/lib/prisma'

type ProfileState = {
  birthDate?: Date | null
  gender?: string | null
  height?: number | null
  weight?: number | null
  health?: Record<string, unknown> | null
  nutrition?: Record<string, unknown> | null
  training?: Record<string, unknown> | null
  mindfulness?: Record<string, unknown> | null
  goals?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

describe('syncProfileFromConversation', () => {
  let state: ProfileState | null

  beforeEach(() => {
    vi.clearAllMocks()
    state = null

    vi.mocked(prisma.userProfile.findUnique).mockImplementation(async () => state as never)

    vi.mocked(prisma.userProfile.upsert).mockImplementation(async (args: any) => {
      if (!state) {
        state = {
          birthDate: args.create.birthDate ?? null,
          gender: args.create.gender ?? null,
          height: args.create.height ?? null,
          weight: args.create.weight ?? null,
          health: args.create.health as Record<string, unknown>,
          nutrition: args.create.nutrition as Record<string, unknown>,
          training: args.create.training as Record<string, unknown>,
          mindfulness: args.create.mindfulness as Record<string, unknown>,
          goals: args.create.goals as Record<string, unknown>,
          settings: args.create.settings as Record<string, unknown>,
        }
      } else {
        state = {
          ...state,
          ...args.update,
          health: (args.update.health as Record<string, unknown>) ?? state.health,
          nutrition: (args.update.nutrition as Record<string, unknown>) ?? state.nutrition,
          training: (args.update.training as Record<string, unknown>) ?? state.training,
          mindfulness: (args.update.mindfulness as Record<string, unknown>) ?? state.mindfulness,
          goals: (args.update.goals as Record<string, unknown>) ?? state.goals,
          settings: (args.update.settings as Record<string, unknown>) ?? state.settings,
        }
      }
      return state as never
    })
  })

  it('esegue merge idempotente su retry con stesso syncId', async () => {
    const payload = {
      userId: 'u1',
      conversationId: 'c1',
      userMessage: 'Voglio dimagrire',
      assistantMessage: 'Procediamo con piano nutrizione e training',
      domain: 'nutrizione' as const,
      primarySpecialist: 'dietista' as const,
      contributors: ['dietista', 'personal_trainer'],
      knownData: {
        sesso: 'uomo',
        altezza: '180 cm',
        peso: '86 kg',
      },
      attachments: [
        {
          type: 'image' as const,
          url: 'https://cdn.local/progress.jpg',
          fileName: 'progress.jpg',
        },
        {
          type: 'audio' as const,
          url: 'https://cdn.local/note.webm',
          fileName: 'note.webm',
        },
      ],
      specialistTurns: [
        { specialistId: 'dietista' as const, content: 'Riduci zuccheri semplici.' },
      ],
      syncId: 'sync-001',
    }

    await syncProfileFromConversation(payload)
    await syncProfileFromConversation(payload)

    expect(prisma.userProfile.upsert).toHaveBeenCalledTimes(1)

    const nutrition = (state?.nutrition ?? {}) as Record<string, unknown>
    const nutritionHistory = Array.isArray(nutrition._history)
      ? (nutrition._history as Array<Record<string, unknown>>)
      : []
    expect(nutritionHistory).toHaveLength(1)
    expect(nutritionHistory[0].syncId).toBe('sync-001')

    const settings = (state?.settings ?? {}) as Record<string, unknown>
    const audit = Array.isArray(settings.aiAuditLog)
      ? (settings.aiAuditLog as Array<Record<string, unknown>>)
      : []
    const attachments = Array.isArray(settings.attachmentHistory)
      ? (settings.attachmentHistory as Array<Record<string, unknown>>)
      : []
    const memory = settings.aiSpecialistMemory as Record<string, Record<string, string[]>>

    expect(audit).toHaveLength(1)
    expect(attachments).toHaveLength(2)
    expect(
      attachments.map((item) => `${item.type}|${item.url}|${item.fileName}`),
    ).toEqual([
      'image|https://cdn.local/progress.jpg|progress.jpg',
      'audio|https://cdn.local/note.webm|note.webm',
    ])
    expect(memory.c1.dietista).toHaveLength(1)
  })

  it('accetta sync diversi e appende storico in modo consistente', async () => {
    const base = {
      userId: 'u1',
      conversationId: 'c1',
      userMessage: 'Aggiornamento',
      assistantMessage: 'Nuove indicazioni',
      domain: 'allenamento' as const,
      primarySpecialist: 'personal_trainer' as const,
      contributors: ['personal_trainer'],
      knownData: {
        sesso: 'uomo',
      },
      specialistTurns: [
        { specialistId: 'personal_trainer' as const, content: 'Incrementa progressivamente i carichi.' },
      ],
    }

    await syncProfileFromConversation({ ...base, syncId: 'sync-002' })
    await syncProfileFromConversation({ ...base, syncId: 'sync-003' })

    expect(prisma.userProfile.upsert).toHaveBeenCalledTimes(2)

    const training = (state?.training ?? {}) as Record<string, unknown>
    const trainingHistory = Array.isArray(training._history)
      ? (training._history as Array<Record<string, unknown>>)
      : []

    expect(trainingHistory).toHaveLength(2)
    expect(trainingHistory.map((h) => h.syncId)).toEqual(['sync-002', 'sync-003'])

    const settings = (state?.settings ?? {}) as Record<string, unknown>
    const ledger = Array.isArray(settings.aiSyncLedger)
      ? (settings.aiSyncLedger as string[])
      : []
    expect(ledger).toEqual(['sync-002', 'sync-003'])
  })
})
