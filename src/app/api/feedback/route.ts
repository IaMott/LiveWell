/**
 * POST /api/feedback
 * Registra rating (1-5) + commento opzionale per un messaggio AI.
 *
 * I dati vengono salvati in MessageReview — tabella isolata dal profilo utente.
 * userHash = SHA-256(userId)[0..16] — anonimizzato, non tracciabile a ritroso.
 *
 * GET /api/feedback?messageId=xxx
 * Recupera la review dell'utente per un messaggio specifico.
 */

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

const postSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().min(1),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  domain: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
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

  const { messageId, conversationId, agentId, agentName, domain, rating, comment } = parsed.data
  const userHash = hashUserId(userId)

  const existing = await prisma.messageReview.findUnique({
    where: { userHash_messageId: { userHash, messageId } },
    select: { id: true },
  })

  const review = existing
    ? await prisma.messageReview.update({
        where: { id: existing.id },
        data: { rating, comment: comment ?? null },
        select: { id: true, rating: true, comment: true, updatedAt: true },
      })
    : await prisma.messageReview.create({
        data: {
          userHash,
          messageId,
          conversationId,
          agentId: agentId ?? null,
          agentName: agentName ?? null,
          domain: domain ?? null,
          rating,
          comment: comment ?? null,
        },
        select: { id: true, rating: true, comment: true, createdAt: true },
      })

  return NextResponse.json({ ok: true, review })
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const url = new URL(request.url)
  const messageId = url.searchParams.get('messageId')
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

  const userHash = hashUserId(userId)
  const review = await prisma.messageReview.findUnique({
    where: { userHash_messageId: { userHash, messageId } },
    select: { rating: true, comment: true, updatedAt: true },
  })

  return NextResponse.json({ review: review ?? null })
}
