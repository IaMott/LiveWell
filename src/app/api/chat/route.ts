import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { orchestrate, buildContext } from '@/lib/ai'
import type { AIMessage } from '@/lib/ai'

const attachmentSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  type: z.enum(['image', 'barcode']),
  barcodeValue: z.string().optional(),
})

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
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

  const { message, conversationId, attachments } = result.data
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

  // Save user message with attachments
  await prisma.message.create({
    data: {
      role: 'user',
      content: message,
      conversationId: convId,
      attachments: attachments
        ? {
            create: attachments.map((a) => ({
              type: a.type,
              fileName: a.fileName,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
              url: a.url,
              metadata: a.barcodeValue ? JSON.stringify({ barcodeValue: a.barcodeValue }) : null,
            })),
          }
        : undefined,
    },
  })

  // Load conversation history for context
  const history = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
    take: 20, // Last 20 messages for context window
  })

  const aiMessages: AIMessage[] = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Build conversation context
  const context = buildContext(aiMessages, userId)

  // Map attachments for orchestrator
  const aiAttachments = attachments?.map((a) => ({
    type: a.type,
    url: a.url,
    fileName: a.fileName,
    barcodeValue: a.barcodeValue,
  }))

  // Run orchestrator
  const aiResponse = await orchestrate(message, context, aiAttachments)

  // SSE stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send conversation metadata
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'meta',
          conversationId: convId,
          specialist: aiResponse.specialist,
          audit: aiResponse.audit,
        })}\n\n`),
      )

      // Stream response word by word
      const words = aiResponse.content.split(' ')
      let accumulated = ''

      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: word + ' ' })}\n\n`),
        )
        await new Promise((r) => setTimeout(r, 30))
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
