import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
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
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          attachments: {
            select: {
              id: true,
              type: true,
              fileName: true,
              mimeType: true,
              url: true,
              metadata: true,
            },
          },
        },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
  }

  return NextResponse.json({ conversation })
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

  const deleted = await prisma.conversation.deleteMany({
    where: { id, userId: session.user.id },
  })

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
  }

  return NextResponse.json({ deletedCount: deleted.count })
}
