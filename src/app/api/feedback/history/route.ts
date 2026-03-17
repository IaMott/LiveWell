/**
 * GET /api/feedback/history
 * Restituisce tutti i feedback lasciati dall'utente, ordinati per data decrescente.
 * Usa userHash per identificare l'utente senza esporre dati sensibili.
 */

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200)

  const userHash = hashUserId(userId)

  const reviews = await prisma.messageReview.findMany({
    where: { userHash },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      messageId: true,
      conversationId: true,
      agentId: true,
      agentName: true,
      domain: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ reviews, total: reviews.length })
}
