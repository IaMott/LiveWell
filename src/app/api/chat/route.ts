import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
})

export async function POST(request: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json()
  const result = chatSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    )
  }

  const { message, conversationId } = result.data
  const userId = session.user.id

  // Get or create conversation
  let convId = conversationId
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: {
        userId,
        title: message.slice(0, 60),
      },
    })
    convId = conv.id
  } else {
    // Verify ownership
    const conv = await prisma.conversation.findFirst({
      where: { id: convId, userId },
    })
    if (!conv) {
      return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 })
    }
  }

  // Save user message
  await prisma.message.create({
    data: {
      role: 'user',
      content: message,
      conversationId: convId,
    },
  })

  // SSE stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send conversation ID first
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'meta', conversationId: convId })}\n\n`),
      )

      // Mock AI response — replaced by real Gemini orchestrator in STEP 7+8
      const mockReply =
        'Ho ricevuto il tuo messaggio. Il team di specialisti AI sarà collegato presto (STEP 7-8). Per ora, posso confermare che il sistema di chat funziona correttamente!'

      const words = mockReply.split(' ')
      let accumulated = ''

      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: word + ' ' })}\n\n`),
        )
        await new Promise((r) => setTimeout(r, 50))
      }

      // Save assistant message to DB
      await prisma.message.create({
        data: {
          role: 'assistant',
          content: accumulated,
          conversationId: convId!,
        },
      })

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
