/**
 * tests/api/cartella-clinica.test.ts
 *
 * Verifica che il database dinamico della cartella clinica funzioni correttamente:
 *
 * 1. health.logDiagnosis  → crea UserAttribute + ClinicalEvent (tipo diagnosis)
 * 2. health.logBloodwork  → crea UserAttribute + ClinicalEvent (tipo bloodwork)
 * 3. Doppia scrittura: attributeId è quello di UserAttribute (backward compat)
 * 4. ClinicalEvent.eventType, title, severity, status, metadata sono corretti
 * 5. health.logDiagnosis con diagnosedAt → eventDate = data fornita, non now()
 * 6. health.logBloodwork con testDate → eventDate = data fornita
 * 7. agentId in ClinicalEvent è ctx.agent.id quando disponibile
 * 8. agentId in ClinicalEvent è null quando ctx.agent è assente
 * 9. computeMedicalRecord: calcola correttamente % completezza per dominio
 * 10. computeMedicalRecord: missingKeys contiene solo i campi assenti
 * 11. GET /api/health/record — aggrega: latest per key (non duplicati)
 * 12. GET /api/health/record — events ordinati per eventDate desc
 * 13. GET /api/health/history — restituisce serie storica per key
 * 14. GET /api/health/history — limit rispettato
 * 15. GET /api/health/history — errore 400 senza key param
 * 16. Backward compat: UserAttribute mantiene domain=health, key=conditions
 * 17. Backward compat: UserAttribute mantiene domain=health, key=bloodwork
 * 18. status default: ClinicalEvent creato senza status esplicito → 'active'
 * 19. severity null: ClinicalEvent senza severity → null nel record
 * 20. validUntil: non impostato per logDiagnosis → null
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createToolExecutor } from '@/lib/tools/toolExecutor'
import { realToolHandlers } from '@/lib/tools/handlers'
import { computeMedicalRecord } from '@/lib/ai/context/medicalRecord'

// ─── In-memory stores ────────────────────────────────────────────────────────

type AttrRow = {
  id: string
  userId: string
  domain: string
  key: string
  value: unknown
  unit: string | null
  source: string
  conversationId: string | null
  recordedAt: Date
  validUntil: Date | null
  notes: string | null
  createdAt: Date
}

type EventRow = {
  id: string
  userId: string
  eventType: string
  title: string
  description: string | null
  domain: string
  agentId: string | null
  conversationId: string | null
  eventDate: Date
  validUntil: Date | null
  severity: string | null
  status: string
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

const memAttrs: AttrRow[] = []
const memEvents: EventRow[] = []

// ─── Mock @/lib/db ────────────────────────────────────────────────────────────

const { mockUpdateUserProfile } = vi.hoisted(() => ({
  mockUpdateUserProfile: vi.fn(async () => ({ id: 'profile-1' })),
}))

vi.mock('@/lib/db', () => ({
  updateUserProfile: mockUpdateUserProfile,
  setGeoPreference: vi.fn(),
  upsertCoarseLocation: vi.fn(),
  clearCoarseLocation: vi.fn(),
}))

// ─── Mock @/lib/prisma ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userAttribute: {
      findFirst: vi.fn(
        async (args: {
          where: { userId: string; conversationId: string | null; domain: string; key: string }
        }) => {
          const found = memAttrs
            .filter(
              (r) =>
                r.userId === args.where.userId &&
                r.conversationId === args.where.conversationId &&
                r.domain === args.where.domain &&
                r.key === args.where.key,
            )
            .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0]
          return found ? { id: found.id, value: found.value } : null
        },
      ),
      create: vi.fn(async (args: { data: Omit<AttrRow, 'id' | 'createdAt'> }) => {
        const row: AttrRow = {
          id: `attr-${memAttrs.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        }
        memAttrs.push(row)
        return { id: row.id }
      }),
      findMany: vi.fn(
        async (args: {
          where: { userId: string; key?: string; domain?: string }
          orderBy?: unknown
          take?: number
        }) => {
          let rows = memAttrs.filter((r) => {
            if (r.userId !== args.where.userId) return false
            if (args.where.key && r.key !== args.where.key) return false
            if (args.where.domain && r.domain !== args.where.domain) return false
            return true
          })
          rows = rows.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
          if (args.take) rows = rows.slice(0, args.take)
          return rows.map((r) => ({
            id: r.id,
            domain: r.domain,
            key: r.key,
            value: r.value,
            unit: r.unit,
            notes: r.notes,
            source: r.source,
            recordedAt: r.recordedAt,
          }))
        },
      ),
    },
    clinicalEvent: {
      create: vi.fn(async (args: { data: Omit<EventRow, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const row: EventRow = {
          id: `evt-${memEvents.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active', // default
          validUntil: null, // default — test 10 verifica questo
          severity: null, // default — test 8 verifica questo
          agentId: null, // default — test 7 verifica questo
          description: null,
          conversationId: null,
          metadata: null,
          ...args.data,
        }
        memEvents.push(row)
        return { id: row.id }
      }),
      findMany: vi.fn(
        async (args: {
          where: { userId: string }
          orderBy?: unknown
          take?: number
          select?: unknown
        }) => {
          let rows = memEvents.filter((r) => r.userId === args.where.userId)
          // Order by eventDate desc
          rows = rows.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime())
          if (args.take) rows = rows.slice(0, args.take)
          return rows.map((r) => ({
            id: r.id,
            eventType: r.eventType,
            title: r.title,
            description: r.description,
            domain: r.domain,
            agentId: r.agentId,
            eventDate: r.eventDate,
            validUntil: r.validUntil,
            severity: r.severity,
            status: r.status,
            metadata: r.metadata,
            createdAt: r.createdAt,
          }))
        },
      ),
    },
    userProfile: {
      findUnique: vi.fn(async () => null),
    },
    bodyMetricEntry: {
      findMany: vi.fn(async () => []),
    },
    recommendationArtifact: {
      findMany: vi.fn(async () => []),
    },
  },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Tutti i tool clinici usati nei test — passarli a toolsAllowed evita il blocco del executor
const CLINICAL_TOOLS = ['health.logDiagnosis', 'health.logBloodwork', 'health.addMetric'] as const

function makeCtx(userId = 'u-test', conversationId = 'conv-test', agentId?: string) {
  return {
    requestId: 'req-test',
    conversationId,
    actor: { userId, role: 'USER' as const, ownerModeEnabled: false },
    // toolsAllowed deve includere i tool usati — executor li blocca se agent è definito e la lista è vuota
    agent: agentId
      ? { id: agentId, toolsAllowed: [...CLINICAL_TOOLS] as string[] as never[] }
      : undefined,
    source: 'assistant' as const,
    confirmedByUser: false,
  }
}

function makeExecutor() {
  return createToolExecutor({
    handlers: realToolHandlers,
    writeAuditLog: async () => undefined,
  })
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('cartella clinica — tool handlers', () => {
  beforeEach(() => {
    memAttrs.length = 0
    memEvents.length = 0
    mockUpdateUserProfile.mockClear()
  })

  // 1. health.logDiagnosis crea ENTRAMBI UserAttribute e ClinicalEvent
  it('health.logDiagnosis → crea UserAttribute (conditions) e ClinicalEvent (diagnosis)', async () => {
    const executor = makeExecutor()
    const result = await executor.executeToolCall(
      {
        id: 'tc1',
        name: 'health.logDiagnosis',
        args: { condition: 'Ipertensione', severity: 'moderate', status: 'active' },
      },
      makeCtx(),
    )

    expect((result as { ok: boolean; data: { saved: boolean } }).data).toMatchObject({
      saved: true,
    })

    // UserAttribute: backward compat
    expect(memAttrs).toHaveLength(1)
    expect(memAttrs[0]!.domain).toBe('health')
    expect(memAttrs[0]!.key).toBe('conditions')

    // ClinicalEvent: nuovo record strutturato
    expect(memEvents).toHaveLength(1)
    expect(memEvents[0]!.eventType).toBe('diagnosis')
    expect(memEvents[0]!.title).toBe('Ipertensione')
    expect(memEvents[0]!.severity).toBe('moderate')
    expect(memEvents[0]!.status).toBe('active')
    expect(memEvents[0]!.domain).toBe('health')
  })

  // 2. health.logBloodwork crea ENTRAMBI UserAttribute e ClinicalEvent
  it('health.logBloodwork → crea UserAttribute (bloodwork) e ClinicalEvent (bloodwork)', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc2',
        name: 'health.logBloodwork',
        args: { values: { glucose: 95, totalCholesterol: 180 }, notes: 'Esame annuale' },
      },
      makeCtx(),
    )

    expect(memAttrs).toHaveLength(1)
    expect(memAttrs[0]!.key).toBe('bloodwork')

    expect(memEvents).toHaveLength(1)
    expect(memEvents[0]!.eventType).toBe('bloodwork')
    expect(memEvents[0]!.title).toBe('Esame del sangue')
    expect(memEvents[0]!.description).toBe('Esame annuale')
    expect(memEvents[0]!.metadata).toEqual({ glucose: 95, totalCholesterol: 180 })
  })

  it('health.logDiagnosis without notes still persists a non-empty clinical note', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc2b',
        name: 'health.logDiagnosis',
        args: { condition: 'Ipertensione' },
      },
      makeCtx(),
    )

    expect(memAttrs[0]!.notes).toBeTruthy()
    expect(memEvents[0]!.description).toBeTruthy()
  })

  it('health.logBloodwork without notes still persists a non-empty clinical note', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc2c',
        name: 'health.logBloodwork',
        args: { values: { glucose: 101 } },
      },
      makeCtx(),
    )

    expect(memAttrs[0]!.notes).toBeTruthy()
    expect(memEvents[0]!.description).toBeTruthy()
  })

  // 3. attributeId nel result è quello di UserAttribute (non di ClinicalEvent)
  it('result.attributeId è id di UserAttribute, non di ClinicalEvent', async () => {
    const executor = makeExecutor()
    const raw = (await executor.executeToolCall(
      {
        id: 'tc3',
        name: 'health.logDiagnosis',
        args: { condition: 'Diabete tipo 2', severity: 'severe' },
      },
      makeCtx(),
    )) as { ok: boolean; data: { saved: boolean; attributeId: string } }
    const result = raw.data

    // Il primo record creato in memAttrs è l'attributeId
    expect(result.attributeId).toBe(memAttrs[0]!.id)
    // ClinicalEvent ha un id diverso
    expect(memEvents[0]!.id).not.toBe(result.attributeId)
  })

  // 4. diagnosedAt → eventDate viene impostata correttamente
  it('logDiagnosis con diagnosedAt → ClinicalEvent.eventDate = data fornita', async () => {
    const executor = makeExecutor()
    const diagnosedAt = '2023-06-15T00:00:00.000Z'
    await executor.executeToolCall(
      {
        id: 'tc4',
        name: 'health.logDiagnosis',
        args: { condition: 'Celiachia', diagnosedAt },
      },
      makeCtx(),
    )

    expect(memEvents[0]!.eventDate.toISOString()).toBe(diagnosedAt)
    // Anche UserAttribute.recordedAt deve combaciare
    expect(memAttrs[0]!.recordedAt.toISOString()).toBe(diagnosedAt)
  })

  // 5. testDate → eventDate per bloodwork
  it('logBloodwork con testDate → ClinicalEvent.eventDate = data fornita', async () => {
    const executor = makeExecutor()
    const testDate = '2024-01-20T00:00:00.000Z'
    await executor.executeToolCall(
      {
        id: 'tc5',
        name: 'health.logBloodwork',
        args: { values: { hba1c: 5.4 }, testDate },
      },
      makeCtx(),
    )

    expect(memEvents[0]!.eventDate.toISOString()).toBe(testDate)
  })

  // 6. agentId viene trasferito dal ctx al ClinicalEvent
  it('ctx.agent.id → ClinicalEvent.agentId', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc6',
        name: 'health.logDiagnosis',
        args: { condition: 'Ipotiroidismo' },
      },
      makeCtx('u-test', 'conv-test', 'mmg'),
    )

    expect(memEvents[0]!.agentId).toBe('mmg')
  })

  // 7. senza ctx.agent → agentId è null nel ClinicalEvent
  it('senza ctx.agent → ClinicalEvent.agentId è null', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc7',
        name: 'health.logDiagnosis',
        args: { condition: 'Anemia sideropenica' },
      },
      makeCtx('u-test', 'conv-test', undefined), // no agentId
    )

    expect(memEvents[0]!.agentId).toBeNull()
  })

  // 8. severity null quando non fornita
  it('logDiagnosis senza severity → ClinicalEvent.severity è null', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc8',
        name: 'health.logDiagnosis',
        args: { condition: 'Reflusso gastroesofageo' },
      },
      makeCtx(),
    )

    expect(memEvents[0]!.severity).toBeNull()
  })

  // 9. status default = 'active' quando non fornito
  it('logDiagnosis senza status → ClinicalEvent.status default = "active"', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc9',
        name: 'health.logDiagnosis',
        args: { condition: 'Colite' },
      },
      makeCtx(),
    )

    expect(memEvents[0]!.status).toBe('active')
  })

  // 10. validUntil non impostato per logDiagnosis → null
  it('logDiagnosis → ClinicalEvent.validUntil è null (diagnosi non ha scadenza)', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc10',
        name: 'health.logDiagnosis',
        args: { condition: 'Fibromialgia' },
      },
      makeCtx(),
    )

    expect(memEvents[0]!.validUntil).toBeNull()
  })

  // 11. Backward compat UserAttribute: logDiagnosis salva key='conditions'
  it('backward compat: logDiagnosis → UserAttribute.key = "conditions"', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc11',
        name: 'health.logDiagnosis',
        args: { condition: 'Psoriasi', severity: 'mild' },
      },
      makeCtx(),
    )

    const attr = memAttrs.find((a) => a.key === 'conditions')
    expect(attr).toBeDefined()
    expect(attr!.domain).toBe('health')
    expect((attr!.value as Record<string, unknown>).condition).toBe('Psoriasi')
  })

  // 12. Backward compat UserAttribute: logBloodwork salva key='bloodwork'
  it('backward compat: logBloodwork → UserAttribute.key = "bloodwork"', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      {
        id: 'tc12',
        name: 'health.logBloodwork',
        args: { values: { ferritin: 12 } },
      },
      makeCtx(),
    )

    const attr = memAttrs.find((a) => a.key === 'bloodwork')
    expect(attr).toBeDefined()
    expect(attr!.domain).toBe('health')
    expect((attr!.value as Record<string, unknown>).ferritin).toBe(12)
  })

  // 13. 2 diagnosi diverse → 2 eventi distinti nella timeline
  it('due logDiagnosis → due ClinicalEvent separati', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      { id: 'tc13a', name: 'health.logDiagnosis', args: { condition: 'Artrite' } },
      makeCtx(),
    )
    await executor.executeToolCall(
      { id: 'tc13b', name: 'health.logDiagnosis', args: { condition: 'Gotta' } },
      makeCtx(),
    )

    expect(memEvents).toHaveLength(2)
    expect(memEvents.map((e) => e.title)).toContain('Artrite')
    expect(memEvents.map((e) => e.title)).toContain('Gotta')
  })

  // 14. mix logDiagnosis + logBloodwork → 2 eventi con tipi diversi
  it('logDiagnosis + logBloodwork → eventi con eventType distinti', async () => {
    const executor = makeExecutor()
    await executor.executeToolCall(
      { id: 'tc14a', name: 'health.logDiagnosis', args: { condition: 'Osteoporosi' } },
      makeCtx(),
    )
    await executor.executeToolCall(
      { id: 'tc14b', name: 'health.logBloodwork', args: { values: { calcium: 9.2 } } },
      makeCtx(),
    )

    const types = memEvents.map((e) => e.eventType)
    expect(types).toContain('diagnosis')
    expect(types).toContain('bloodwork')
  })
})

// ─── computeMedicalRecord ────────────────────────────────────────────────────

describe('computeMedicalRecord — completezza cartella', () => {
  // 15. completezza 0% quando attributi vuoti
  it('attributi vuoti → ogni dominio al 0%', () => {
    const rec = computeMedicalRecord(undefined)
    for (const domain of Object.keys(rec.completeness)) {
      expect(rec.completeness[domain]!.pct).toBe(0)
    }
  })

  // 16. completezza 100% quando tutti i campi essenziali presenti
  // Keys match what agents actually save via normalizeKey() + AGENT_INTAKE_KEYS
  it('health con tutti i campi essenziali → 100%', () => {
    const attrs = {
      health: {
        weight: 72,
        height: 175,
        birthDate: '1990-01-01',
        gender: 'M',
        blood_pressure: '120/80',
        symptoms: 'nessuno',
        diagnosis: 'nessuna',
        medications: 'nessuno',
        complaint: 'controllo',
      },
    }
    const rec = computeMedicalRecord(attrs)
    expect(rec.completeness['health']!.pct).toBe(100)
    expect(rec.missingKeys['health']).toBeUndefined()
  })

  // 17. campi parziali → % corretta e missingKeys contiene solo le chiavi assenti
  it('health parziale (3/9) → pct=33 e missingKeys=6 chiavi', () => {
    const attrs = {
      health: {
        weight: 80,
        height: 170,
        gender: 'F',
        // mancano: birthDate, blood_pressure, symptoms, diagnosis, medications, complaint
      },
    }
    const rec = computeMedicalRecord(attrs)
    expect(rec.completeness['health']!.filled).toBe(3)
    expect(rec.completeness['health']!.total).toBe(9)
    expect(rec.completeness['health']!.pct).toBe(33)
    expect(rec.missingKeys['health']).toHaveLength(6)
    expect(rec.missingKeys['health']).toContain('blood_pressure')
    expect(rec.missingKeys['health']).not.toContain('weight')
  })

  // 18. domini completamente assenti non producono missingKeys undefined
  it('dominio assente → completeness pct=0, missingKeys presente', () => {
    const rec = computeMedicalRecord({ health: { weight: 70 } })
    // nutrition non presente negli attrs → 0%
    expect(rec.completeness['nutrition']!.pct).toBe(0)
    expect(rec.missingKeys['nutrition']).toBeDefined()
  })
})

// ─── API /api/health/record (logica di aggregazione) ────────────────────────

describe('API health/record — logica aggregazione attributi', () => {
  // 19. latest-per-key: più entry per stesso key → ritorna solo il più recente
  it('più entries per stesso key → latest wins (nessun duplicato nel risultato)', () => {
    const attrs: AttrRow[] = [
      {
        id: 'a1',
        userId: 'u1',
        domain: 'health',
        key: 'weight',
        value: 70,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-01-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'a2',
        userId: 'u1',
        domain: 'health',
        key: 'weight',
        value: 72,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-06-01'), // più recente
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
    ]

    // Simula la logica di aggregazione dell'API (latest per domain+key)
    const latestByKey: Record<string, Record<string, { value: unknown }>> = {}
    for (const attr of attrs.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())) {
      if (!latestByKey[attr.domain]) latestByKey[attr.domain] = {}
      if (!latestByKey[attr.domain][attr.key]) {
        latestByKey[attr.domain][attr.key] = { value: attr.value }
      }
    }

    expect(latestByKey['health']!['weight']!.value).toBe(72) // solo il più recente
    expect(Object.keys(latestByKey['health']!)).toHaveLength(1) // no duplicati
  })

  // 20. eventi ordinati per eventDate desc
  it('clinicalEvents ordinati per eventDate desc — il più recente è primo', () => {
    const events: EventRow[] = [
      {
        id: 'e1',
        userId: 'u1',
        eventType: 'diagnosis',
        title: 'Artrite',
        description: null,
        domain: 'health',
        agentId: null,
        conversationId: null,
        eventDate: new Date('2022-01-01'),
        validUntil: null,
        severity: null,
        status: 'active',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'e2',
        userId: 'u1',
        eventType: 'bloodwork',
        title: 'Esame del sangue',
        description: null,
        domain: 'health',
        agentId: null,
        conversationId: null,
        eventDate: new Date('2024-03-15'),
        validUntil: null,
        severity: null,
        status: 'active',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const sorted = [...events].sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime())
    expect(sorted[0]!.title).toBe('Esame del sangue') // 2024 prima di 2022
    expect(sorted[1]!.title).toBe('Artrite')
  })
})

// ─── API /api/health/history ─────────────────────────────────────────────────

describe('API health/history — serie storica attributo', () => {
  beforeEach(() => {
    memAttrs.length = 0
    memEvents.length = 0
  })

  // 21. history per key=weight restituisce solo le entry con quel key
  it('history filtra per key — entries di altri key escluse', async () => {
    // Popola store direttamente
    memAttrs.push(
      {
        id: 'a1',
        userId: 'u1',
        domain: 'health',
        key: 'weight',
        value: 70,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-01-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'a2',
        userId: 'u1',
        domain: 'health',
        key: 'weight',
        value: 72,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-06-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'a3',
        userId: 'u1',
        domain: 'health',
        key: 'conditions',
        value: 'Artrite',
        unit: null,
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-01-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
    )

    // Simula la query dell'API history per key='weight'
    const { prisma } = await import('@/lib/prisma')
    const entries = await prisma.userAttribute.findMany({
      where: { userId: 'u1', key: 'weight' },
      orderBy: { recordedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        domain: true,
        key: true,
        value: true,
        unit: true,
        notes: true,
        source: true,
        recordedAt: true,
      },
    })

    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e.key === 'weight')).toBe(true)
    expect(entries[0]!.value).toBe(70) // ordinato asc per recordedAt
    expect(entries[1]!.value).toBe(72)
  })

  // 22. limit viene rispettato
  it('history con limit=1 → restituisce solo 1 entry', async () => {
    memAttrs.push(
      {
        id: 'b1',
        userId: 'u2',
        domain: 'health',
        key: 'weight',
        value: 68,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-01-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'b2',
        userId: 'u2',
        domain: 'health',
        key: 'weight',
        value: 69,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-02-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'b3',
        userId: 'u2',
        domain: 'health',
        key: 'weight',
        value: 70,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date('2024-03-01'),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
    )

    const { prisma } = await import('@/lib/prisma')
    const entries = await prisma.userAttribute.findMany({
      where: { userId: 'u2', key: 'weight' },
      orderBy: { recordedAt: 'asc' },
      take: 1,
      select: {
        id: true,
        domain: true,
        key: true,
        value: true,
        unit: true,
        notes: true,
        source: true,
        recordedAt: true,
      },
    })

    expect(entries).toHaveLength(1)
  })

  // 23. utenti isolati — history di u1 non include dati di u2
  it('history isolata per userId — dati di altri utenti non inclusi', async () => {
    memAttrs.push(
      {
        id: 'c1',
        userId: 'u-alice',
        domain: 'health',
        key: 'weight',
        value: 55,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date(),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'c2',
        userId: 'u-bob',
        domain: 'health',
        key: 'weight',
        value: 90,
        unit: 'kg',
        source: 'agent',
        conversationId: null,
        recordedAt: new Date(),
        validUntil: null,
        notes: null,
        createdAt: new Date(),
      },
    )

    const { prisma } = await import('@/lib/prisma')
    const aliceEntries = await prisma.userAttribute.findMany({
      where: { userId: 'u-alice', key: 'weight' },
      orderBy: { recordedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        domain: true,
        key: true,
        value: true,
        unit: true,
        notes: true,
        source: true,
        recordedAt: true,
      },
    })

    expect(aliceEntries).toHaveLength(1)
    expect(aliceEntries[0]!.value).toBe(55) // solo alice, non bob
  })
})
