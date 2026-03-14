/**
 * GET /api/admin/audit
 * Audit log esteso — include tool mutations + eventi di moderation.
 * Accessibile a ADMIN/OWNER. Gli utenti normali usano /api/audit-log
 * che mostra solo i propri log.
 *
 * Query params:
 *   userId?       — filtra per utente specifico
 *   toolName?     — filtra per nome tool
 *   status?       — 'success' | 'error' | 'blocked'
 *   from?         — ISO date (default: 7 giorni fa)
 *   to?           — ISO date (default: ora)
 *   limit?        — default 50, max 200
 *   offset?       — default 0
 *   include?      — 'tools' | 'moderation' | 'all' (default: 'all')
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUserId, getAuthRole } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'

const querySchema = z.object({
  userId: z.string().optional(),
  toolName: z.string().optional(),
  status: z.enum(['success', 'error', 'blocked']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  include: z.enum(['tools', 'moderation', 'all']).default('all'),
})

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const role = await getAuthRole(request)
  if (role !== 'ADMIN' && role !== 'OWNER') {
    return errorResponse(401, 'UNAUTHORIZED', 'Insufficient permissions')
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const { userId: filterUserId, toolName, status, limit, offset, include } = parsed.data

  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date()

  const [toolLogs, moderationLogs] = await Promise.all([
    include !== 'moderation'
      ? prisma.toolAuditLog.findMany({
          where: {
            ...(filterUserId ? { userId: filterUserId } : {}),
            ...(toolName ? { toolName } : {}),
            ...(status ? { status } : {}),
            createdAt: { gte: from, lte: to },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            userId: true,
            conversationId: true,
            toolName: true,
            status: true,
            inputSummary: true,
            requestId: true,
            errorCode: true,
            createdAt: true,
          },
        })
      : [],

    include !== 'tools'
      ? prisma.moderationLog.findMany({
          where: {
            ...(filterUserId ? { userId: filterUserId } : {}),
            createdAt: { gte: from, lte: to },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            userId: true,
            conversationId: true,
            flagType: true,
            severity: true,
            action: true,
            requestId: true,
            createdAt: true,
          },
        })
      : [],
  ])

  return NextResponse.json({
    toolLogs: toolLogs.map((l) => ({ ...l, logType: 'tool' as const })),
    moderationLogs: moderationLogs.map((l) => ({ ...l, logType: 'moderation' as const })),
    period: { from: from.toISOString(), to: to.toISOString() },
    limit,
    offset,
  })
}
