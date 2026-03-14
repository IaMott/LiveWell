/**
 * POST /api/admin/retention
 * Esegue la retention policy GDPR: cancella dati vecchi oltre le soglie configurate.
 *
 * Solo ruolo OWNER o ADMIN può chiamare questo endpoint.
 * Pensato per essere chiamato da cron job (Vercel Cron / GitHub Actions).
 *
 * Policy default (configurabile via body):
 * - Messages soft-deleted da più di 90 giorni → hard delete
 * - Conversations soft-deleted da più di 90 giorni → hard delete
 * - ToolAuditLog più vecchi di 365 giorni → delete
 * - ApiErrorEvent più vecchi di 180 giorni → delete
 * - ModerationLog più vecchi di 365 giorni → delete
 * - AgentPerformanceLog più vecchi di 180 giorni → delete
 *
 * GET /api/admin/retention
 * Mostra statistiche sui dati candidati per la purge.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, getAuthRole } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'

const policySchema = z.object({
  softDeletedDays: z.number().int().min(30).max(730).default(90),
  auditLogDays: z.number().int().min(90).max(3650).default(365),
  errorLogDays: z.number().int().min(30).max(730).default(180),
  moderationLogDays: z.number().int().min(90).max(3650).default(365),
  performanceLogDays: z.number().int().min(30).max(730).default(180),
  dryRun: z.boolean().default(true), // sempre dry-run di default
})

type PolicyConfig = z.infer<typeof policySchema>

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function countCandidates(cfg: PolicyConfig) {
  const softDeletedCutoff = daysAgo(cfg.softDeletedDays)
  const auditCutoff = daysAgo(cfg.auditLogDays)
  const errorCutoff = daysAgo(cfg.errorLogDays)
  const moderationCutoff = daysAgo(cfg.moderationLogDays)
  const perfCutoff = daysAgo(cfg.performanceLogDays)

  const [messages, conversations, auditLogs, errorEvents, moderationLogs, perfLogs] =
    await Promise.all([
      prisma.message.count({
        where: { deletedAt: { not: null, lt: softDeletedCutoff } },
      }),
      prisma.conversation.count({
        where: { deletedAt: { not: null, lt: softDeletedCutoff } },
      }),
      prisma.toolAuditLog.count({
        where: { createdAt: { lt: auditCutoff } },
      }),
      prisma.apiErrorEvent.count({
        where: { createdAt: { lt: errorCutoff } },
      }),
      prisma.moderationLog.count({
        where: { createdAt: { lt: moderationCutoff } },
      }),
      prisma.agentPerformanceLog.count({
        where: { createdAt: { lt: perfCutoff } },
      }),
    ])

  return { messages, conversations, auditLogs, errorEvents, moderationLogs, perfLogs }
}

async function executePurge(cfg: PolicyConfig) {
  const softDeletedCutoff = daysAgo(cfg.softDeletedDays)
  const auditCutoff = daysAgo(cfg.auditLogDays)
  const errorCutoff = daysAgo(cfg.errorLogDays)
  const moderationCutoff = daysAgo(cfg.moderationLogDays)
  const perfCutoff = daysAgo(cfg.performanceLogDays)

  const [messages, conversations, auditLogs, errorEvents, moderationLogs, perfLogs] =
    await Promise.all([
      prisma.message.deleteMany({
        where: { deletedAt: { not: null, lt: softDeletedCutoff } },
      }),
      prisma.conversation.deleteMany({
        where: { deletedAt: { not: null, lt: softDeletedCutoff } },
      }),
      prisma.toolAuditLog.deleteMany({
        where: { createdAt: { lt: auditCutoff } },
      }),
      prisma.apiErrorEvent.deleteMany({
        where: { createdAt: { lt: errorCutoff } },
      }),
      prisma.moderationLog.deleteMany({
        where: { createdAt: { lt: moderationCutoff } },
      }),
      prisma.agentPerformanceLog.deleteMany({
        where: { createdAt: { lt: perfCutoff } },
      }),
    ])

  return {
    messages: messages.count,
    conversations: conversations.count,
    auditLogs: auditLogs.count,
    errorEvents: errorEvents.count,
    moderationLogs: moderationLogs.count,
    perfLogs: perfLogs.count,
  }
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const role = await getAuthRole(request)
  if (role !== 'ADMIN' && role !== 'OWNER') {
    return errorResponse(401, 'UNAUTHORIZED', 'Insufficient permissions')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = policySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const cfg = parsed.data

  if (cfg.dryRun) {
    const candidates = await countCandidates(cfg)
    return NextResponse.json({
      dryRun: true,
      policy: cfg,
      candidates,
      message: 'Set dryRun: false to execute deletion',
    })
  }

  const deleted = await executePurge(cfg)

  return NextResponse.json({
    dryRun: false,
    policy: cfg,
    deleted,
    executedAt: new Date().toISOString(),
  })
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const role = await getAuthRole(request)
  if (role !== 'ADMIN' && role !== 'OWNER') {
    return errorResponse(401, 'UNAUTHORIZED', 'Insufficient permissions')
  }

  const defaultCfg = policySchema.parse({})
  const candidates = await countCandidates(defaultCfg)

  return NextResponse.json({
    policy: defaultCfg,
    candidates,
    note: 'Use POST with dryRun: false to execute',
  })
}
