import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAuthUserId } from '@/lib/auth'
import { decodeAssistantStoredContent } from '@/lib/chat/thinkingPersistence'
import { sanitizeAssistantVisibleContent } from '@/lib/chat/userVisibleContent'
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
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          domain: true,
          specialistName: true,
          replyToMessageId: true,
          attachments: {
            select: { fileName: true, mimeType: true, fileSize: true },
          },
        },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  // Build feedback map (messageId → review) when requested
  type FeedbackReview = {
    messageId: string
    rating: number
    comment: string | null
    agentName: string | null
    createdAt: Date
  }
  const feedbackMap = new Map<
    string,
    { rating: number; comment: string | null; agentName: string | null }
  >()
  if (includeFeedback) {
    const userHash = hashUserId(userId)
    const reviews = await prisma.messageReview.findMany({
      where: { conversationId: id, userHash },
      orderBy: { createdAt: 'asc' },
      select: { messageId: true, rating: true, comment: true, agentName: true, createdAt: true },
    })
    const assistantMessages = conversation.messages
      .filter((m) => m.role === 'assistant')
      .filter((m) => {
        const decoded = decodeAssistantStoredContent(m.content)
        return sanitizeAssistantVisibleContent(decoded.content).length > 0
      })
    const exactMatchedMessageIds = new Set<string>()
    const unmatchedReviews: FeedbackReview[] = []

    for (const r of reviews) {
      const review = {
        messageId: r.messageId,
        rating: r.rating,
        comment: r.comment,
        agentName: r.agentName,
        createdAt: r.createdAt,
      }
      if (assistantMessages.some((m) => m.id === r.messageId)) {
        feedbackMap.set(r.messageId, {
          rating: r.rating,
          comment: r.comment,
          agentName: r.agentName,
        })
        exactMatchedMessageIds.add(r.messageId)
      } else {
        unmatchedReviews.push(review)
      }
    }

    const fallbackAssignedMessageIds = new Set<string>()
    for (const review of unmatchedReviews) {
      const reviewTs = new Date(review.createdAt).getTime()
      const candidate = [...assistantMessages]
        .filter((m) => !exactMatchedMessageIds.has(m.id) && !fallbackAssignedMessageIds.has(m.id))
        .filter((m) => new Date(m.createdAt).getTime() <= reviewTs)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .pop()

      if (!candidate) continue

      feedbackMap.set(candidate.id, {
        rating: review.rating,
        comment: review.comment,
        agentName: review.agentName,
      })
      fallbackAssignedMessageIds.add(candidate.id)
    }
  }

  // Build id→content map for reply-to resolution
  const msgContentMap = new Map<string, string>()
  for (const m of conversation.messages) {
    const decoded = m.role === 'assistant' ? decodeAssistantStoredContent(m.content) : null
    msgContentMap.set(m.id, decoded?.content ?? m.content)
  }

  const lines: string[] = [
    'LiveWell — Conversazione',
    `Esportata il: ${new Date().toLocaleString('it-IT')}`,
    includeFeedback ? 'Inclusi: feedback messaggi' : '',
    'Inclusi: ragionamenti agenti',
    '─'.repeat(40),
    '',
  ].filter((l) => l !== '')

  for (const m of conversation.messages) {
    const decoded = m.role === 'assistant' ? decodeAssistantStoredContent(m.content) : null
    const messageContent =
      m.role === 'assistant'
        ? sanitizeAssistantVisibleContent(decoded?.content ?? m.content)
        : m.content
    if (m.role === 'assistant' && !messageContent && !(decoded?.thinkingSteps?.length ?? 0)) {
      continue
    }
    const who =
      m.role === 'user'
        ? 'Tu'
        : ((m as { specialistName?: string | null }).specialistName ?? 'LiveWell')
    const ts = new Date(m.createdAt).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    lines.push(`[${ts}] ${who}:`)
    // Reply-to indicator: show quoted snippet of the parent message
    if (m.replyToMessageId) {
      const parentContent = msgContentMap.get(m.replyToMessageId)
      if (parentContent) {
        const snippet = parentContent.replace(/\n+/g, ' ').slice(0, 80)
        lines.push(
          `  ↩ In risposta a: "${snippet.length < parentContent.replace(/\n+/g, ' ').length ? snippet + '…' : snippet}"`,
        )
      }
    }
    // P5: Show attachments for user messages
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      for (const att of m.attachments) {
        const sizeKb = Math.round(att.fileSize / 1024)
        lines.push(`  📎 ${att.fileName} (${att.mimeType}, ${sizeKb}KB)`)
      }
    }
    lines.push(messageContent)

    if (decoded?.thinkingSteps && decoded.thinkingSteps.length > 0) {
      lines.push('  Ragionamento agenti:')
      for (const step of decoded.thinkingSteps) {
        const domain = step.domain ? ` [${step.domain}]` : ''
        lines.push(`  - ${step.specialistName}${domain}: ${step.title}`)
        if (step.thought) {
          for (const line of step.thought.split('\n')) {
            lines.push(`    ${line}`)
          }
        }
      }
    }

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
