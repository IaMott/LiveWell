import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params

  const conversation = await prisma.conversation.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      createdAt: true,
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

  return NextResponse.json({ conversation })
}
