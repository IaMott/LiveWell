import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  conversationId: z.string().nullish(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }),
  ),
})

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json()
  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Input non valido' }, { status: 400 })
  }

  const userId = session.user.id
  const { messages } = result.data
  let { conversationId } = result.data

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Nessun messaggio' }, { status: 400 })
  }

  // Create or verify conversation
  if (!conversationId) {
    const firstUserMsg = messages.find((m) => m.role === 'user')
    const conv = await prisma.conversation.create({
      data: {
        userId,
        title: firstUserMsg
          ? `🎙️ ${firstUserMsg.content.slice(0, 50)}`
          : '🎙️ Sessione live',
      },
    })
    conversationId = conv.id
  } else {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    })
    if (!conv) {
      return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
    }
  }

  // Save all messages
  await prisma.message.createMany({
    data: messages.map((m) => ({
      role: m.role,
      content: m.role === 'user' ? `🎙️ ${m.content}` : m.content,
      conversationId: conversationId!,
    })),
  })

  return NextResponse.json({ conversationId })
}
