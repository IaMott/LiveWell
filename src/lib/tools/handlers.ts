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

import { prisma } from '@/lib/prisma'
import { updateUserProfile, setGeoPreference, upsertCoarseLocation, clearCoarseLocation } from '@/lib/db'
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

// ─────────────────────────────────────────
// Real handler implementations
// ─────────────────────────────────────────

const userUpdateProfile: Handler = async (args, ctx) => {
  const { fields } = args as { fields: Record<string, unknown> }
  await updateUserProfile(ctx.actor.userId, fields)
  return { saved: true }
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

// share.createLink is destructive + owner-mode: keep stub pending real share token logic
const shareCreateLink: Handler = async (args) => {
  const a = args as { resourceType: string; resourceId: string }
  return { shareUrl: `https://livewell.local/share/${a.resourceType}/${a.resourceId}` }
}

// export.pdf is a future feature step
const exportPdf: Handler = async () => ({ url: 'https://livewell.local/export/mock.pdf' })

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const realToolHandlers: HandlerMap = {
  'user.updateProfile': userUpdateProfile,
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
}

export const stubToolHandlers: HandlerMap = {
  'user.updateProfile': async () => ({ saved: true }),
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
    const a = args as { resourceType: string; resourceId: string }
    return { shareUrl: `https://livewell.local/share/${a.resourceType}/${a.resourceId}` }
  },
  'export.pdf': async () => ({ url: 'https://livewell.local/export/mock.pdf' }),
  'geo.setPreference': async (args) => {
    const a = args as { enabled: boolean }
    return { saved: true, enabled: a.enabled }
  },
  'geo.updateCoarseLocation': async () => ({ saved: true }),
  'geo.clearLocation': async () => ({ cleared: true }),
}
