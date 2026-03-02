import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { orchestrateStream, buildContext } from '@/lib/ai'
import type { AIMessage } from '@/lib/ai'

const attachmentSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  type: z.enum(['image', 'barcode', 'audio']),
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
    take: 20,
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

  // SSE stream response using orchestrator streaming
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = ''

      try {
        // Send conversation ID immediately
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'meta', conversationId: convId })}\n\n`),
        )

        for await (const event of orchestrateStream(message, context, aiAttachments)) {
          if (event.type === 'routing') {
            // Send specialist routing info
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'routing',
                specialist: event.data.specialist,
                audit: event.data.audit,
              })}\n\n`),
            )
          } else if (event.type === 'delta') {
            accumulated += event.content
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: event.content })}\n\n`),
            )
          }
        }

        // Save assistant message to DB
        if (accumulated) {
          await prisma.message.create({
            data: {
              role: 'assistant',
              content: accumulated,
              conversationId: convId!,
            },
          })
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        )
      } catch (err) {
        console.error('[Chat API] Stream error:', err)
        const errorMsg = 'Errore durante la generazione della risposta. Riprova.'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: errorMsg })}\n\n`),
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        )
      } finally {
        controller.close()
      }
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
