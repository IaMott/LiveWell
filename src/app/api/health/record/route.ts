/**
 * GET /api/health/record
 *
 * Restituisce la cartella clinica completa dell'utente:
 *  - profilo base (età, peso, altezza, genere)
 *  - completezza per dominio
 *  - ultimi valori per ogni attributo (per dominio)
 *  - eventi clinici strutturati (ClinicalEvent)
 *  - storico metriche corpo (BodyMetricEntry) — ultimi 90gg
 *  - raccomandazioni salvate dagli agenti
 */

import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeMedicalRecord } from '@/lib/ai/context/medicalRecord'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import type { UserAttributes } from '@/lib/ai/types'

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `health-record:${userId}:${getClientIp(request)}`, max: 30 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const [profile, allAttributes, bodyMetrics, clinicalEvents, artifacts] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),

    // Tutti gli attributi — ordinati per data desc, poi raggruppiamo per domain+key (latest first)
    prisma.userAttribute.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      select: { domain: true, key: true, value: true, unit: true, recordedAt: true, notes: true },
    }),

    // Storico metriche corpo ultimi 90 giorni
    prisma.bodyMetricEntry.findMany({
      where: { userId, recordedAt: { gte: since90d } },
      orderBy: { recordedAt: 'desc' },
      select: { metricType: true, value: true, unit: true, recordedAt: true },
    }),

    // Tutti gli eventi clinici, dal più recente
    prisma.clinicalEvent.findMany({
      where: { userId },
      orderBy: { eventDate: 'desc' },
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        domain: true,
        agentId: true,
        eventDate: true,
        validUntil: true,
        severity: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    }),

    // Ultime 10 raccomandazioni
    prisma.recommendationArtifact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, type: true, title: true, contentMarkdown: true, createdAt: true },
    }),
  ])

  // ── Aggrega attributi: latest per domain+key (UserAttributes snapshot) ──
  const latestByKey: Record<
    string,
    Record<string, { value: unknown; unit: string | null; recordedAt: string }>
  > = {}
  for (const attr of allAttributes) {
    if (!latestByKey[attr.domain]) latestByKey[attr.domain] = {}
    if (!latestByKey[attr.domain][attr.key]) {
      latestByKey[attr.domain][attr.key] = {
        value: attr.value,
        unit: attr.unit,
        recordedAt: attr.recordedAt.toISOString(),
      }
    }
  }

  // Converte nel formato UserAttributes per computeMedicalRecord
  const userAttrs: UserAttributes = {}
  for (const [domain, keys] of Object.entries(latestByKey)) {
    ;(userAttrs as Record<string, Record<string, unknown>>)[domain] = Object.fromEntries(
      Object.entries(keys).map(([k, v]) => [k, v.value]),
    )
  }
  const record = computeMedicalRecord(userAttrs)

  // ── Raggruppa body metrics per tipo ──
  const metricsByType: Record<
    string,
    Array<{ value: number; unit: string | null; date: string }>
  > = {}
  for (const m of bodyMetrics) {
    if (!metricsByType[m.metricType]) metricsByType[m.metricType] = []
    metricsByType[m.metricType].push({
      value: m.value,
      unit: m.unit,
      date: m.recordedAt.toISOString(),
    })
  }

  return Response.json({
    profile: profile
      ? {
          birthDate: profile.birthDate?.toISOString() ?? null,
          gender: profile.gender ?? null,
          height: profile.height ?? null,
          weight: profile.weight ?? null,
        }
      : null,

    completeness: record.completeness,
    missingKeys: record.missingKeys,

    // Snapshot corrente per dominio (valore più recente per ogni chiave)
    attributes: latestByKey,

    // Timeline eventi clinici strutturati
    clinicalEvents: clinicalEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      domain: e.domain,
      agentId: e.agentId,
      eventDate: e.eventDate.toISOString(),
      validUntil: e.validUntil?.toISOString() ?? null,
      severity: e.severity,
      status: e.status,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),

    // Metriche corpo nel tempo (per grafici)
    bodyMetrics: metricsByType,

    // Raccomandazioni salvate dagli agenti
    recommendations: artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      contentMarkdown: a.contentMarkdown,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}
