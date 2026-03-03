import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Rate limit: 10 share creations per minute per user
  const rl = rateLimit(`share-create:${session.user.id}`, { max: 10 })
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  const { id } = await params

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
  }

  // If already shared, return existing token
  if (conversation.shareToken) {
    return NextResponse.json({
      shareToken: conversation.shareToken,
      shareUrl: `/share/${conversation.shareToken}`,
    })
  }

  // Generate unique share token
  const shareToken = randomBytes(16).toString('hex')

  await prisma.conversation.update({
    where: { id },
    data: { shareToken, sharedAt: new Date() },
  })

  return NextResponse.json({
    shareToken,
    shareUrl: `/share/${shareToken}`,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { id } = await params

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
  }

  await prisma.conversation.update({
    where: { id },
    data: { shareToken: null, sharedAt: null },
  })

  return NextResponse.json({ success: true })
}
