import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, role: true },
      },
    },
  })

  return NextResponse.json({ conversations })
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')

  if (conversationId) {
    const deleted = await prisma.conversation.deleteMany({
      where: { id: conversationId, userId: session.user.id },
    })
    return NextResponse.json({ deletedCount: deleted.count })
  }

  const deleted = await prisma.conversation.deleteMany({
    where: { userId: session.user.id },
  })
  return NextResponse.json({ deletedCount: deleted.count })
}
