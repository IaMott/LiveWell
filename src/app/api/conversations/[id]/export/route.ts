import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

const STAR_LABELS: Record<number, string> = {
  1: 'Pessimo',
  2: 'Scarso',
  3: 'Sufficiente',
  4: 'Buono',
  5: 'Ottimo',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { id } = await params
  const url = new URL(request.url)
  const includeFeedback = url.searchParams.get('includeFeedback') === 'true'

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  // Build feedback map (messageId → review) when requested
  const feedbackMap = new Map<
    string,
    { rating: number; comment: string | null; agentName: string | null }
  >()
  if (includeFeedback) {
    const userHash = hashUserId(userId)
    const reviews = await prisma.messageReview.findMany({
      where: { conversationId: id, userHash },
      select: { messageId: true, rating: true, comment: true, agentName: true },
    })
    for (const r of reviews) {
      feedbackMap.set(r.messageId, { rating: r.rating, comment: r.comment, agentName: r.agentName })
    }
  }

  const lines: string[] = [
    'LiveWell — Conversazione',
    `Esportata il: ${new Date().toLocaleString('it-IT')}`,
    includeFeedback ? 'Inclusi: feedback messaggi' : '',
    '─'.repeat(40),
    '',
  ].filter((l) => l !== '')

  for (const m of conversation.messages) {
    const who = m.role === 'user' ? 'Tu' : 'LiveWell'
    const ts = new Date(m.createdAt).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    lines.push(`[${ts}] ${who}:`)
    lines.push(m.content)

    // Append feedback annotation after assistant messages
    if (includeFeedback && m.role === 'assistant') {
      const review = feedbackMap.get(m.id)
      if (review) {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)
        const label = STAR_LABELS[review.rating] ?? ''
        const agent = review.agentName ? ` [${review.agentName}]` : ''
        const comment = review.comment ? ` — "${review.comment}"` : ''
        lines.push(`  ${stars} ${label}${agent}${comment}`)
      }
    }

    lines.push('')
  }

  const text = lines.join('\n')
  const suffix = includeFeedback ? '-feedback' : ''

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="livewell-${id.slice(0, 8)}${suffix}.txt"`,
    },
  })
}
