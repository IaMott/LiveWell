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

  // Generate plain text export
  const title = conversation.title || 'Conversazione LiveWell'
  const date = new Date(conversation.createdAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  let text = `${title}\n`
  text += `Esportata il ${date}\n`
  text += '='.repeat(50) + '\n\n'

  for (const msg of conversation.messages) {
    const role = msg.role === 'user' ? 'Tu' : 'LiveWell'
    const time = new Date(msg.createdAt).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
    text += `[${time}] ${role}:\n${msg.content}\n\n`
  }

  text += '='.repeat(50) + '\n'
  text += 'Generato da LiveWell - Il tuo assistente benessere\n'

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="livewell-${id.slice(0, 8)}.txt"`,
    },
  })
}
