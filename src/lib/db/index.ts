/**
 * DB Adapter Layer — LiveWell
 *
 * Centralized typed interface over Prisma for all domain queries.
 * All functions used by ContextPackBuilder, tool handlers, and API routes.
 *
 * Privacy contract:
 * - getCoarseLocation() returns only country/region/city/timezone, never raw coords.
 * - Geo coordinates are stored rounded (2 decimal places ≈ 1km precision).
 */

import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type AuditLogInput = {
  actorUserId: string
  conversationId?: string | null
  toolCallId: string
  toolName: string
  inputSummary: string
  inputHash: string
  status: 'success' | 'failure'
  requestId: string
  errorCode?: string | null
}

export type CoarseLocationInput = {
  country?: string
  region?: string
  city?: string
  timezone?: string
  lat?: number
  lon?: number
  accuracy?: string
}

export type CoarseLocationResult = {
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  accuracy: string | null
}

// ─────────────────────────────────────────
// User
// ─────────────────────────────────────────

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  })
}

// ─────────────────────────────────────────
// Profile
// ─────────────────────────────────────────

export async function updateUserProfile(
  userId: string,
  data: Record<string, unknown>,
) {
  return prisma.userProfile.upsert({
    where: { userId },
    create: { userId, ...(data as object) },
    update: data as object,
  })
}

// ─────────────────────────────────────────
// Conversations & Messages
// ─────────────────────────────────────────

export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true, createdAt: true },
  })
}

export async function createMessage(input: {
  conversationId: string
  role: 'user' | 'assistant'
  content: string
}) {
  return prisma.message.create({ data: input })
}

export async function getRecentConversationMessages(
  conversationId: string,
  limit = 20,
) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { role: true, content: true, createdAt: true },
  })
  // Return in chronological order
  return rows.reverse()
}

// ─────────────────────────────────────────
// Health trackers
// ─────────────────────────────────────────

export async function getUserHealthMetrics(userId: string, since?: Date) {
  return prisma.bodyMetricEntry.findMany({
    where: {
      userId,
      ...(since ? { recordedAt: { gte: since } } : {}),
    },
    orderBy: { recordedAt: 'desc' },
    take: 50,
    select: { id: true, metricType: true, value: true, unit: true, recordedAt: true },
  })
}

// ─────────────────────────────────────────
// Nutrition
// ─────────────────────────────────────────

export async function getNutritionLogs(userId: string, since?: Date) {
  return prisma.meal.findMany({
    where: {
      createdByUserId: userId,
      ...(since ? { date: { gte: since } } : {}),
    },
    orderBy: { date: 'desc' },
    take: 50,
    select: { id: true, mealType: true, date: true, items: true, notes: true },
  })
}

// ─────────────────────────────────────────
// Training
// ─────────────────────────────────────────

export async function getWorkoutSessions(userId: string, since?: Date) {
  return prisma.workoutSession.findMany({
    where: {
      userId,
      ...(since ? { date: { gte: since } } : {}),
    },
    orderBy: { date: 'desc' },
    take: 50,
    select: { id: true, durationMin: true, perceivedEffort: true, date: true, planId: true },
  })
}

// ─────────────────────────────────────────
// Mindfulness
// ─────────────────────────────────────────

export async function getMindfulnessEntries(userId: string, since?: Date) {
  return prisma.mindfulnessEntry.findMany({
    where: {
      userId,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, mood: true, stress: true, content: true, createdAt: true },
  })
}

// ─────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.toolAuditLog.create({
    data: {
      userId: input.actorUserId,
      conversationId: input.conversationId ?? null,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      inputSummary: input.inputSummary,
      inputHash: input.inputHash,
      status: input.status,
      requestId: input.requestId,
      errorCode: input.errorCode ?? null,
    },
  })
}

// ─────────────────────────────────────────
// Geolocation (privacy-first)
// ─────────────────────────────────────────

export async function getGeoPreference(userId: string) {
  return prisma.geoPreference.findUnique({
    where: { userId },
    select: { enabled: true, country: true, region: true, city: true, timezone: true, accuracy: true },
  })
}

export async function setGeoPreference(userId: string, enabled: boolean): Promise<void> {
  await prisma.geoPreference.upsert({
    where: { userId },
    create: { userId, enabled },
    update: { enabled },
  })
}

/**
 * Stores coarse location from browser geolocation.
 *
 * Privacy invariants:
 * - lat/lon are rounded to 2 decimal places (≈1km grid) before storage.
 * - Raw precise coordinates are never persisted.
 */
export async function upsertCoarseLocation(
  userId: string,
  location: CoarseLocationInput,
): Promise<void> {
  const latCoarse =
    location.lat !== undefined
      ? Math.round(location.lat * 100) / 100
      : undefined
  const lonCoarse =
    location.lon !== undefined
      ? Math.round(location.lon * 100) / 100
      : undefined

  const data = {
    country: location.country ?? null,
    region: location.region ?? null,
    city: location.city ?? null,
    timezone: location.timezone ?? null,
    latCoarse: latCoarse ?? null,
    lonCoarse: lonCoarse ?? null,
    accuracy: location.accuracy ?? 'coarse',
  }

  await prisma.geoPreference.upsert({
    where: { userId },
    create: { userId, enabled: true, ...data },
    update: data,
  })
}

/**
 * Returns coarse location for ContextPack injection.
 *
 * Privacy invariants:
 * - Returns null if geo is disabled.
 * - Never returns raw latCoarse/lonCoarse to callers; only human-readable fields.
 * - Must never appear in push/SMS payloads or public share pages.
 */
export async function getCoarseLocation(userId: string): Promise<CoarseLocationResult | null> {
  const pref = await prisma.geoPreference.findUnique({
    where: { userId },
    select: {
      enabled: true,
      country: true,
      region: true,
      city: true,
      timezone: true,
      accuracy: true,
      // latCoarse/lonCoarse intentionally NOT selected — internal storage only
    },
  })

  if (!pref || !pref.enabled) return null

  return {
    country: pref.country,
    region: pref.region,
    city: pref.city,
    timezone: pref.timezone,
    accuracy: pref.accuracy,
  }
}

/**
 * Clears stored coarse location (called when geo is disabled by user).
 */
export async function clearCoarseLocation(userId: string): Promise<void> {
  await prisma.geoPreference.updateMany({
    where: { userId },
    data: {
      country: null,
      region: null,
      city: null,
      timezone: null,
      latCoarse: null,
      lonCoarse: null,
      accuracy: null,
    },
  })
}
