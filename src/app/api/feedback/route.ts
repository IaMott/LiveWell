/**
 * POST /api/feedback
 * Registra il rating utente (1-5 stelle) per una risposta AI.
 *
 * Body: { conversationId, requestId, rating, comment? }
 *
 * GET /api/feedback?conversationId=xxx
 * Recupera i feedback dell'utente per una conversazione.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { updateUserFeedback } from '@/lib/ai/agentPerformance'

const postSchema = z.object({
  conversationId: z.string().min(1),
  requestId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body')
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const { conversationId, requestId, rating, comment } = parsed.data

  // Verify conversation belongs to user
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  })
  if (!convo || convo.userId !== userId) {
    return errorResponse(404, 'NOT_FOUND', 'Conversation not found')
  }

  // Find-or-create pattern (avoids compound key naming issues across Prisma versions)
  const existing = await prisma.userFeedback.findFirst({
    where: { userId, requestId },
    select: { id: true },
  })
  const feedback = existing
    ? await prisma.userFeedback.update({
        where: { id: existing.id },
        data: { rating, comment: comment ?? null },
        select: { id: true, rating: true, createdAt: true },
      })
    : await prisma.userFeedback.create({
        data: { userId, conversationId, requestId, rating, comment: comment ?? null },
        select: { id: true, rating: true, createdAt: true },
      })

  // Also update AgentPerformanceLog (fire-and-forget)
  updateUserFeedback({ userId, requestId, feedback: rating as 1 | 2 | 3 | 4 | 5 }).catch(() => {
    // non-critical
  })

  return NextResponse.json({ ok: true, feedback })
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const url = new URL(request.url)
  const conversationId = url.searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  // Verify ownership
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  })
  if (!convo || convo.userId !== userId) {
    return errorResponse(404, 'NOT_FOUND', 'Conversation not found')
  }

  const feedbacks = await prisma.userFeedback.findMany({
    where: { userId, conversationId },
    select: { requestId: true, rating: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const avg =
    feedbacks.length > 0
      ? feedbacks.reduce((s: number, f: { rating: number }) => s + f.rating, 0) / feedbacks.length
      : null

  return NextResponse.json({
    feedbacks,
    avg: avg ? Math.round(avg * 10) / 10 : null,
    total: feedbacks.length,
  })
}
