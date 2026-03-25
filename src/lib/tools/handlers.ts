/**
 * Tool handler implementations — LiveWell
 *
 * Real DB mutations for all non-destructive tools.
 * Each handler receives Zod-validated args (cast from unknown) and ToolExecutionContext.
 *
 * handlers.ts is server-only; never imported in client bundles.
 *
 * Tool safety contract (enforced upstream in toolExecutor.ts):
 * - Args are already Zod-validated before reaching handlers.
 * - Audit log is written by toolExecutor after handler returns.
 * - Destructive tools require confirmToken (handled upstream).
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  updateUserProfile,
  setGeoPreference,
  upsertCoarseLocation,
  clearCoarseLocation,
} from '@/lib/db'
import type { ToolName } from './toolRegistry'
import type { ToolExecutionHandler } from './toolExecutor'

type Handler = ToolExecutionHandler
type HandlerMap = Partial<Record<ToolName, Handler>>

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function toDate(iso?: string): Date {
  return iso ? new Date(iso) : new Date()
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function normalizeDomain(
  raw: string,
):
  | 'health'
  | 'nutrition'
  | 'training'
  | 'mindfulness'
  | 'personal'
  | 'general'
  | 'career'
  | 'financial' {
  const d = raw.trim().toLowerCase()
  if (d === 'mind' || d === 'mental') return 'mindfulness'
  if (d === 'person' || d === 'profile') return 'personal'
  if (d === 'sport') return 'training'
  if (d === 'life-organizer' || d === 'life_organizer' || d === 'organizer') return 'career'
  if (d === 'commercialista' || d === 'accountant' || d === 'fiscal' || d === 'tax')
    return 'financial'
  if (d === 'financial' || d === 'finance' || d === 'finances') return 'financial'
  if (d === 'career' || d === 'lavoro' || d === 'work') return 'career'
  if (d === 'idea' || d === 'inspiration' || d === 'ideas') return 'career'
  if (
    d === 'health' ||
    d === 'nutrition' ||
    d === 'training' ||
    d === 'mindfulness' ||
    d === 'personal' ||
    d === 'general'
  ) {
    return d
  }
  return 'general'
}

function normalizeKey(raw: string, domain: string): string {
  const k = raw.trim()
  const low = k.toLowerCase()

  if (domain === 'health') {
    // Canonical health dictionary
    if (
      low === 'hypertension' ||
      low.startsWith('medicalconditions.hypertension') ||
      low.startsWith('hypertension_status')
    ) {
      return 'hypertension'
    }
    if (
      low === 'hypertensiondiagnoseddate' ||
      low === 'hypertension_diagnosed_date' ||
      low === 'hypertension_diagnosis_year' ||
      low === 'hypertensiondiagnosedyear' ||
      low === 'hypertension_diagnosed_year'
    ) {
      return 'hypertension_diagnosed_year'
    }
    if (low === 'medicalconditions') return 'medical_condition_note'
  }

  if (low === 'allergies' || low === 'allergy' || low === 'intolerance' || low === 'intolleranza')
    return 'allergy'
  if (low === 'sleephours' || low === 'sleep_hours' || low === 'ore_sonno') return 'sleep_hours'
  if (low === 'stress' || low === 'stresslevel' || low === 'stress_level') return 'stress_level'
  if (
    low === 'trainingfrequency' ||
    low === 'weeklytraining' ||
    low === 'training_frequency_per_week'
  )
    return 'training_frequency_per_week'
  if (low === 'goal' || low === 'obiettivo' || low === 'objective') return 'goal'
  if (low === 'birth_date' || low === 'dateofbirth' || low === 'dob') return 'birthDate'
  return k
}

// ─────────────────────────────────────────
// Real handler implementations
// ─────────────────────────────────────────

const userUpdateProfile: Handler = async (args, ctx) => {
  const { fields } = args as { fields: Record<string, unknown> }
  await updateUserProfile(ctx.actor.userId, fields)

  // Backward compatibility: if legacy profile scalar fields are updated,
  // append a time-series UserAttribute entry as well.
  const scalarMap: Record<string, { domain: string; key: string; unit?: string }> = {
    weight: { domain: 'personal', key: 'weight', unit: 'kg' },
    height: { domain: 'personal', key: 'height', unit: 'cm' },
    birthDate: { domain: 'personal', key: 'birthDate' },
    gender: { domain: 'personal', key: 'gender' },
  }

  const writes: Promise<unknown>[] = []
  for (const [k, v] of Object.entries(fields)) {
    const m = scalarMap[k]
    if (!m) continue
    if (typeof v !== 'number' && typeof v !== 'string') continue
    writes.push(
      prisma.userAttribute.create({
        data: {
          userId: ctx.actor.userId,
          domain: m.domain,
          key: m.key,
          value: v as Prisma.InputJsonValue,
          unit: m.unit ?? null,
          source: 'agent',
          conversationId: ctx.conversationId,
        },
      }),
    )
  }
  if (writes.length > 0) await Promise.all(writes)

  return { saved: true }
}

const userSetAttribute: Handler = async (args, ctx) => {
  const a = args as {
    domain: string
    key: string
    value: unknown
    unit?: string
    recordedAt?: string
    validUntil?: string
    notes?: string
  }

  let normalizedDomain = normalizeDomain(a.domain)
  const normalizedKey = normalizeKey(a.key, normalizedDomain)

  // Nutrition allergies should stay in nutrition unless explicitly clinical.
  if (normalizedDomain === 'health' && normalizedKey === 'allergy') {
    normalizedDomain = 'nutrition'
  }

  const normalizedValue = a.value as Prisma.InputJsonValue
  const normalizedUnit = a.unit ?? null
  const normalizedRecordedAt = toDate(a.recordedAt)
  const normalizedNotes = a.notes ?? null

  // De-dup exact repeats to reduce noisy duplicated health keys.
  const existing = await prisma.userAttribute.findFirst({
    where: {
      userId: ctx.actor.userId,
      conversationId: ctx.conversationId,
      domain: normalizedDomain,
      key: normalizedKey,
    },
    orderBy: { recordedAt: 'desc' },
    select: { id: true, value: true },
  })
  if (existing && JSON.stringify(existing.value) === JSON.stringify(normalizedValue)) {
    return { saved: true, id: existing.id, deduped: true }
  }

  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: normalizedDomain,
      key: normalizedKey,
      value: normalizedValue,
      unit: normalizedUnit,
      source: 'agent',
      conversationId: ctx.conversationId,
      recordedAt: normalizedRecordedAt,
      validUntil: a.validUntil ? new Date(a.validUntil) : null,
      notes: normalizedNotes,
    },
    select: { id: true },
  })

  // Keep current profile snapshot aligned for UI readers using legacy fields.
  // Handles both 'personal' domain (direct) and 'health' domain (anthropometric data).
  if (normalizedDomain === 'personal' || normalizedDomain === 'health') {
    const profileKey = normalizedKey.toLowerCase()
    const profileUpdate: Record<string, unknown> = {}

    if (profileKey === 'weight') {
      const n = coerceNumber(a.value)
      if (n != null) profileUpdate.weight = n
    }

    if (profileKey === 'height') {
      const n = coerceNumber(a.value)
      if (n != null) profileUpdate.height = n
    }

    if (
      profileKey === 'birthdate' ||
      profileKey === 'dateofbirth' ||
      profileKey === 'date_of_birth' ||
      profileKey === 'dob'
    ) {
      const d = coerceDate(a.value)
      if (d) profileUpdate.birthDate = d
    }

    if (profileKey === 'gender' || profileKey === 'sex' || profileKey === 'sesso') {
      if (typeof a.value === 'string' && a.value.trim() !== '') {
        profileUpdate.gender = a.value.trim().slice(0, 20)
      }
    }

    // Age stays an independent attribute. Do not synthesize a birthDate without
    // an explicit day/month/year provided by the user.
    if (profileKey === 'age' || profileKey === 'eta' || profileKey === 'età') {
      const ageNum = coerceNumber(a.value)
      if (ageNum != null && ageNum > 0 && ageNum < 130) {
        // Intentionally no legacy profile sync for birthDate.
      }
    }

    if (Object.keys(profileUpdate).length > 0) {
      await updateUserProfile(ctx.actor.userId, profileUpdate).catch(() => undefined)
    }
  }

  return { saved: true, id: row.id }
}

const healthAddMetric: Handler = async (args, ctx) => {
  const a = args as { metricType: string; value: number; unit?: string; recordedAt?: string }
  const entry = await prisma.bodyMetricEntry.create({
    data: {
      userId: ctx.actor.userId,
      metricType: a.metricType,
      value: a.value,
      unit: a.unit ?? null,
      recordedAt: toDate(a.recordedAt),
    },
    select: { id: true },
  })
  return { saved: true, id: entry.id }
}

const nutritionLogMeal: Handler = async (args, ctx) => {
  const a = args as {
    mealType: string
    items: Array<{ name: string; quantity: number; unit?: string }>
    consumedAt?: string
  }
  const meal = await prisma.meal.create({
    data: {
      createdByUserId: ctx.actor.userId,
      mealType: a.mealType,
      date: toDate(a.consumedAt),
      items: a.items,
    },
    select: { id: true },
  })
  return { saved: true, id: meal.id }
}

const nutritionCreateFoodItem: Handler = async (args, ctx) => {
  // No separate FoodItem model — save as RecommendationArtifact (nutrition type)
  const a = args as {
    name: string
    kcalPer100g: number
    proteinPer100g?: number
    carbsPer100g?: number
    fatsPer100g?: number
  }
  const lines = [
    `**${a.name}**`,
    `- Energia: ${a.kcalPer100g} kcal/100g`,
    a.proteinPer100g !== undefined ? `- Proteine: ${a.proteinPer100g}g/100g` : null,
    a.carbsPer100g !== undefined ? `- Carboidrati: ${a.carbsPer100g}g/100g` : null,
    a.fatsPer100g !== undefined ? `- Grassi: ${a.fatsPer100g}g/100g` : null,
  ].filter(Boolean) as string[]
  const artifact = await prisma.recommendationArtifact.create({
    data: {
      userId: ctx.actor.userId,
      relatedConversationId: ctx.conversationId,
      type: 'nutrition',
      title: `Alimento: ${a.name}`,
      contentMarkdown: lines.join('\n'),
    },
    select: { id: true },
  })
  return { saved: true, id: artifact.id }
}

const nutritionCreateRecipe: Handler = async (args, ctx) => {
  const a = args as { title: string; servings: number; ingredients: string[]; steps: string[] }
  const contentMarkdown = [
    `## ${a.title}`,
    `**Porzioni**: ${a.servings}`,
    `\n### Ingredienti`,
    a.ingredients.map((i) => `- ${i}`).join('\n'),
    `\n### Procedimento`,
    a.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
  ].join('\n')
  const artifact = await prisma.recommendationArtifact.create({
    data: {
      userId: ctx.actor.userId,
      relatedConversationId: ctx.conversationId,
      type: 'nutrition',
      title: a.title,
      contentMarkdown,
    },
    select: { id: true },
  })
  return { saved: true, id: artifact.id }
}

const trainingCreateWorkoutPlan: Handler = async (args, ctx) => {
  const a = args as {
    title: string
    weeklyDays: number
    sessions: Array<{ day: string; focus: string; durationMin: number }>
  }
  const plan = await prisma.workoutPlan.create({
    data: {
      userId: ctx.actor.userId,
      title: a.title,
      weeklyDays: a.weeklyDays,
      sessions: a.sessions,
    },
    select: { id: true },
  })
  return { saved: true, id: plan.id }
}

const trainingLogWorkoutSession: Handler = async (args, ctx) => {
  const a = args as {
    planId?: string
    durationMin: number
    perceivedEffort?: number
    notes?: string
  }
  const session = await prisma.workoutSession.create({
    data: {
      userId: ctx.actor.userId,
      planId: a.planId ?? null,
      durationMin: a.durationMin,
      perceivedEffort: a.perceivedEffort ?? null,
      notes: a.notes ?? null,
    },
    select: { id: true },
  })
  return { saved: true, id: session.id }
}

const mindfulnessCreateEntry: Handler = async (args, ctx) => {
  const a = args as { mood?: number; stress?: number; content?: string }
  const entry = await prisma.mindfulnessEntry.create({
    data: {
      userId: ctx.actor.userId,
      mood: a.mood ?? null,
      stress: a.stress ?? null,
      content: a.content ?? null,
    },
    select: { id: true },
  })
  return { saved: true, id: entry.id }
}

const artifactsSaveRecommendation: Handler = async (args, ctx) => {
  const a = args as { type: string; title: string; contentMarkdown: string }
  const artifact = await prisma.recommendationArtifact.create({
    data: {
      userId: ctx.actor.userId,
      relatedConversationId: ctx.conversationId,
      type: a.type,
      title: a.title,
      contentMarkdown: a.contentMarkdown,
    },
    select: { id: true },
  })
  return { saved: true, id: artifact.id }
}

const notificationsCreateInApp: Handler = async (args, ctx) => {
  const a = args as { title: string; message: string; category: string }
  // Map tool category → Notification type (schema uses 'specialist' for professional)
  const notificationType = a.category === 'professional' ? 'specialist' : a.category
  const notification = await prisma.notification.create({
    data: {
      userId: ctx.actor.userId,
      type: notificationType,
      title: a.title,
      message: a.message,
    },
    select: { id: true },
  })
  return { saved: true, id: notification.id }
}

// ─────────────────────────────────────────
// Geo handlers (privacy-first)
// ─────────────────────────────────────────

const geoSetPreference: Handler = async (args, ctx) => {
  const a = args as { enabled: boolean }
  await setGeoPreference(ctx.actor.userId, a.enabled)
  if (!a.enabled) await clearCoarseLocation(ctx.actor.userId)
  return { saved: true, enabled: a.enabled }
}

const geoUpdateCoarseLocation: Handler = async (args, ctx) => {
  const a = args as {
    country?: string
    region?: string
    city?: string
    timezone?: string
    lat?: number
    lon?: number
    accuracy?: string
  }
  await upsertCoarseLocation(ctx.actor.userId, a)
  return { saved: true }
}

const geoClearLocation: Handler = async (args, ctx) => {
  void args
  await clearCoarseLocation(ctx.actor.userId)
  return { cleared: true }
}

// share.createLink — real implementation using UserAttribute for token persistence
const shareCreateLink: Handler = async (args, ctx) => {
  const { randomBytes } = await import('node:crypto')
  const a = args as { resourceType: string; resourceId: string; expiresAt?: string }
  const token = randomBytes(16).toString('hex')
  const expiresAt = a.expiresAt ? new Date(a.expiresAt) : null
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://livewell.mottisi.com'
  const shareUrl = `${baseUrl}/share/${token}`

  await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'general',
      key: 'share_token',
      value: JSON.stringify({
        token,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        expiresAt: expiresAt?.toISOString() ?? null,
        shareUrl,
        createdAt: new Date().toISOString(),
      }),
      source: 'agent',
    },
  })

  return { shareUrl, token, expiresAt: expiresAt?.toISOString() ?? null }
}

// export.pdf — returns content ready for client-side PDF generation
const exportPdf: Handler = async (args, ctx) => {
  const a = args as { resourceType: string; resourceId: string }
  const artifact = await prisma.recommendationArtifact.findFirst({
    where: { id: a.resourceId, userId: ctx.actor.userId },
  })

  if (!artifact) {
    return {
      exportFormat: 'error',
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      content: null,
      message: 'Risorsa non trovata. Verifica che la raccomandazione esista.',
    }
  }

  return {
    exportFormat: 'markdown',
    resourceType: artifact.type,
    title: artifact.title,
    content: artifact.contentMarkdown,
    createdAt: artifact.createdAt.toISOString(),
    message: 'Contenuto pronto. Usa il campo "content" per generare il PDF.',
  }
}

// appointment.schedule — crea un appuntamento
const appointmentSchedule: Handler = async (args, ctx) => {
  const a = args as {
    title: string
    scheduledAt: string
    durationMin?: number
    specialist?: string
    location?: string
    description?: string
    notes?: string
  }
  const appointment = await prisma.appointment.create({
    data: {
      userId: ctx.actor.userId,
      title: a.title,
      scheduledAt: new Date(a.scheduledAt),
      durationMin: a.durationMin,
      specialist: a.specialist,
      location: a.location,
      description: a.description,
      notes: a.notes,
    },
  })
  return {
    appointmentId: appointment.id,
    title: appointment.title,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
  }
}

// appointment.cancel — cancella un appuntamento esistente
const appointmentCancel: Handler = async (args, ctx) => {
  const a = args as { appointmentId: string; reason?: string }
  const existing = await prisma.appointment.findFirst({
    where: { id: a.appointmentId, userId: ctx.actor.userId },
  })
  if (!existing) throw new Error('Appuntamento non trovato o non autorizzato')
  if (existing.status === 'cancelled') return { cancelled: false, message: 'Già cancellato' }

  await prisma.appointment.update({
    where: { id: a.appointmentId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      notes: a.reason ? `Motivo cancellazione: ${a.reason}` : existing.notes,
    },
  })
  return { cancelled: true, appointmentId: a.appointmentId }
}

// reminder.create — crea un promemoria
const reminderCreate: Handler = async (args, ctx) => {
  const a = args as {
    title: string
    message: string
    remindAt: string
    appointmentId?: string
    repeat?: string
  }
  const reminder = await prisma.reminder.create({
    data: {
      userId: ctx.actor.userId,
      title: a.title,
      message: a.message,
      remindAt: new Date(a.remindAt),
      appointmentId: a.appointmentId ?? null,
      repeat: a.repeat ?? 'none',
    },
  })
  return {
    reminderId: reminder.id,
    title: reminder.title,
    remindAt: reminder.remindAt.toISOString(),
    repeat: reminder.repeat,
  }
}

// ─────────────────────────────────────────
// New specialised clinical handlers
// ─────────────────────────────────────────

const healthLogBodyComposition: Handler = async (args, ctx) => {
  const a = args as {
    bodyFatPct?: number
    leanMassKg?: number
    waistCm?: number
    bmi?: number
    recordedAt?: string
    notes?: string
  }
  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'health',
      key: 'bodyComposition',
      value: {
        bodyFatPct: a.bodyFatPct,
        leanMassKg: a.leanMassKg,
        waistCm: a.waistCm,
        bmi: a.bmi,
      } as Prisma.InputJsonValue,
      notes: a.notes ?? null,
      source: 'agent',
      conversationId: ctx.conversationId,
      recordedAt: a.recordedAt ? new Date(a.recordedAt) : new Date(),
    },
  })
  return { saved: true, attributeId: row.id }
}

const healthLogBloodwork: Handler = async (args, ctx) => {
  const a = args as {
    testDate?: string
    values: Record<string, number | undefined>
    notes?: string
  }
  const eventDate = a.testDate ? new Date(a.testDate) : new Date()

  const [row] = await Promise.all([
    // Backward-compat: attribute key/value time-series
    prisma.userAttribute.create({
      data: {
        userId: ctx.actor.userId,
        domain: 'health',
        key: 'bloodwork',
        value: a.values as Prisma.InputJsonValue,
        notes: a.notes ?? null,
        source: 'agent',
        conversationId: ctx.conversationId,
        recordedAt: eventDate,
      },
    }),
    // Cartella clinica: evento strutturato
    prisma.clinicalEvent.create({
      data: {
        userId: ctx.actor.userId,
        eventType: 'bloodwork',
        title: 'Esame del sangue',
        description: a.notes ?? null,
        domain: 'health',
        agentId: ctx.agent?.id ?? null,
        conversationId: ctx.conversationId ?? null,
        eventDate,
        metadata: a.values as Prisma.InputJsonValue,
      },
    }),
  ])

  return { saved: true, attributeId: row.id }
}

const healthLogDiagnosis: Handler = async (args, ctx) => {
  const a = args as {
    condition: string
    diagnosedAt?: string
    severity?: string
    status?: string
    notes?: string
  }
  const eventDate = a.diagnosedAt ? new Date(a.diagnosedAt) : new Date()

  const [row] = await Promise.all([
    // Backward-compat: attribute key/value time-series
    prisma.userAttribute.create({
      data: {
        userId: ctx.actor.userId,
        domain: 'health',
        key: 'conditions',
        value: {
          condition: a.condition,
          severity: a.severity,
          status: a.status ?? 'active',
          diagnosedAt: a.diagnosedAt,
        } as Prisma.InputJsonValue,
        notes: a.notes ?? null,
        source: 'agent',
        conversationId: ctx.conversationId,
        recordedAt: eventDate,
      },
    }),
    // Cartella clinica: evento strutturato
    prisma.clinicalEvent.create({
      data: {
        userId: ctx.actor.userId,
        eventType: 'diagnosis',
        title: a.condition,
        description: a.notes ?? null,
        domain: 'health',
        agentId: ctx.agent?.id ?? null,
        conversationId: ctx.conversationId ?? null,
        eventDate,
        severity: a.severity ?? null,
        status: a.status ?? 'active',
        metadata: { condition: a.condition, diagnosedAt: a.diagnosedAt } as Prisma.InputJsonValue,
      },
    }),
  ])

  return { saved: true, attributeId: row.id }
}

const healthUpdateMedications: Handler = async (args, ctx) => {
  const a = args as {
    medications: Array<{
      name: string
      dosage?: string
      frequency?: string
      since?: string
      notes?: string
    }>
  }
  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'health',
      key: 'medications',
      value: a.medications as Prisma.InputJsonValue,
      source: 'agent',
      conversationId: ctx.conversationId,
    },
  })
  return { saved: true, attributeId: row.id, count: a.medications.length }
}

const nutritionLogWater: Handler = async (args, ctx) => {
  const a = args as { amountMl: number; date?: string }
  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'nutrition',
      key: 'waterIntake',
      value: a.amountMl as Prisma.InputJsonValue,
      unit: 'ml',
      source: 'agent',
      conversationId: ctx.conversationId,
      recordedAt: a.date ? new Date(a.date) : new Date(),
    },
  })
  return { saved: true, attributeId: row.id, amountMl: a.amountMl }
}

const nutritionSetCalorieGoal: Handler = async (args, ctx) => {
  const a = args as {
    targetKcal: number
    proteinPct?: number
    carbsPct?: number
    fatPct?: number
    notes?: string
  }
  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'nutrition',
      key: 'caloricGoal',
      value: {
        targetKcal: a.targetKcal,
        proteinPct: a.proteinPct,
        carbsPct: a.carbsPct,
        fatPct: a.fatPct,
      } as Prisma.InputJsonValue,
      unit: 'kcal',
      notes: a.notes ?? null,
      source: 'agent',
      conversationId: ctx.conversationId,
    },
  })
  return { saved: true, attributeId: row.id, targetKcal: a.targetKcal }
}

const trainingLogInjury: Handler = async (args, ctx) => {
  const a = args as {
    location: string
    severity: number
    type?: string
    since?: string
    status?: string
    notes?: string
  }
  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'training',
      key: 'injuries',
      value: {
        location: a.location,
        severity: a.severity,
        type: a.type,
        status: a.status ?? 'active',
      } as Prisma.InputJsonValue,
      notes: a.notes ?? null,
      source: 'agent',
      conversationId: ctx.conversationId,
      recordedAt: a.since ? new Date(a.since) : new Date(),
    },
  })
  return { saved: true, attributeId: row.id, location: a.location }
}

const trainingUpdatePlan: Handler = async (args, ctx) => {
  const a = args as {
    sessions: Array<{ day: string; type: string; durationMin: number; intensity?: string }>
    goal?: string
    notes?: string
  }
  const row = await prisma.userAttribute.create({
    data: {
      userId: ctx.actor.userId,
      domain: 'training',
      key: 'trainingPlan',
      value: {
        sessions: a.sessions,
        goal: a.goal,
      } as Prisma.InputJsonValue,
      notes: a.notes ?? null,
      source: 'agent',
      conversationId: ctx.conversationId,
    },
  })
  return { saved: true, attributeId: row.id, sessionsCount: a.sessions.length }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const realToolHandlers: HandlerMap = {
  'user.updateProfile': userUpdateProfile,
  'user.setAttribute': userSetAttribute,
  'health.addMetric': healthAddMetric,
  'nutrition.logMeal': nutritionLogMeal,
  'nutrition.createFoodItem': nutritionCreateFoodItem,
  'nutrition.recipes.createRecipe': nutritionCreateRecipe,
  'training.createWorkoutPlan': trainingCreateWorkoutPlan,
  'training.logWorkoutSession': trainingLogWorkoutSession,
  'mindfulness.createEntry': mindfulnessCreateEntry,
  'artifacts.saveRecommendation': artifactsSaveRecommendation,
  'notifications.createInApp': notificationsCreateInApp,
  'share.createLink': shareCreateLink,
  'export.pdf': exportPdf,
  'geo.setPreference': geoSetPreference,
  'geo.updateCoarseLocation': geoUpdateCoarseLocation,
  'geo.clearLocation': geoClearLocation,
  'appointment.schedule': appointmentSchedule,
  'appointment.cancel': appointmentCancel,
  'reminder.create': reminderCreate,
  'health.logBodyComposition': healthLogBodyComposition,
  'health.logBloodwork': healthLogBloodwork,
  'health.logDiagnosis': healthLogDiagnosis,
  'health.updateMedications': healthUpdateMedications,
  'nutrition.logWater': nutritionLogWater,
  'nutrition.setCalorieGoal': nutritionSetCalorieGoal,
  'training.logInjury': trainingLogInjury,
  'training.updatePlan': trainingUpdatePlan,
}

export const stubToolHandlers: HandlerMap = {
  'user.updateProfile': async () => ({ saved: true }),
  'user.setAttribute': async () => ({ saved: true, id: 'stub-attr-id' }),
  'health.addMetric': async () => ({ saved: true }),
  'nutrition.logMeal': async () => ({ saved: true }),
  'nutrition.createFoodItem': async () => ({ saved: true }),
  'nutrition.recipes.createRecipe': async () => ({ saved: true }),
  'training.createWorkoutPlan': async () => ({ saved: true }),
  'training.logWorkoutSession': async () => ({ saved: true }),
  'mindfulness.createEntry': async () => ({ saved: true }),
  'artifacts.saveRecommendation': async () => ({ saved: true }),
  'notifications.createInApp': async () => ({ saved: true }),
  'share.createLink': async (args) => {
    void (args as { resourceType: string; resourceId: string })
    const token = `stub-${Math.random().toString(36).slice(2)}`
    return { shareUrl: `https://livewell.local/share/${token}`, token, expiresAt: null }
  },
  'export.pdf': async () => ({
    exportFormat: 'markdown',
    resourceType: 'nutrition',
    title: 'Stub Export',
    content: '# Stub content',
    message: 'Stub export',
  }),
  'geo.setPreference': async (args) => {
    const a = args as { enabled: boolean }
    return { saved: true, enabled: a.enabled }
  },
  'geo.updateCoarseLocation': async () => ({ saved: true }),
  'geo.clearLocation': async () => ({ cleared: true }),
  'appointment.schedule': async (args) => {
    const a = args as { title: string; scheduledAt: string }
    return {
      appointmentId: 'stub-appt-id',
      title: a.title,
      scheduledAt: a.scheduledAt,
      status: 'pending',
    }
  },
  'appointment.cancel': async (args) => {
    const a = args as { appointmentId: string }
    return { cancelled: true, appointmentId: a.appointmentId }
  },
  'reminder.create': async (args) => {
    const a = args as { title: string; remindAt: string }
    return { reminderId: 'stub-reminder-id', title: a.title, remindAt: a.remindAt, repeat: 'none' }
  },
  'health.logBodyComposition': async () => ({ saved: true, attributeId: 'stub-attr-id' }),
  'health.logBloodwork': async () => ({ saved: true, attributeId: 'stub-attr-id' }),
  'health.logDiagnosis': async () => ({ saved: true, attributeId: 'stub-attr-id' }),
  'health.updateMedications': async () => ({ saved: true, attributeId: 'stub-attr-id', count: 1 }),
  'nutrition.logWater': async (args) => {
    const a = args as { amountMl: number }
    return { saved: true, attributeId: 'stub-attr-id', amountMl: a.amountMl }
  },
  'nutrition.setCalorieGoal': async (args) => {
    const a = args as { targetKcal: number }
    return { saved: true, attributeId: 'stub-attr-id', targetKcal: a.targetKcal }
  },
  'training.logInjury': async (args) => {
    const a = args as { location: string }
    return { saved: true, attributeId: 'stub-attr-id', location: a.location }
  },
  'training.updatePlan': async (args) => {
    const a = args as { sessions: unknown[] }
    return { saved: true, attributeId: 'stub-attr-id', sessionsCount: a.sessions.length }
  },
}
