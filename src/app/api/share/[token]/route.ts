import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

// Share links expire after 30 days
const SHARE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  // Rate limit: 60 per minute per IP (public endpoint)
  const ip = getClientIp(request)
  const rl = rateLimit(`share-view:${ip}`, { max: 60 })
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  const { token } = await params

  // Validate token format (32 hex chars)
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: 'Token non valido' }, { status: 400 })
  }

  const conversation = await prisma.conversation.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      createdAt: true,
      sharedAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
  }

  // Check if share link has expired
  if (
    conversation.sharedAt &&
    Date.now() - new Date(conversation.sharedAt).getTime() > SHARE_EXPIRY_MS
  ) {
    return NextResponse.json(
      { error: 'Il link di condivisione è scaduto' },
      { status: 410 },
    )
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: conversation.messages,
    },
  })
}
