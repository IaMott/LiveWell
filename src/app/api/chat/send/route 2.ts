import { z } from 'zod'
import { checkRateLimit, getClientIp, getUserIdFromRequest } from '@/lib/security/httpGuards'
import { errorResponse } from '@/lib/security/errorSchema'

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().min(1).optional(),
})

type ChatStreamEvent =
  | { type: 'message.delta'; id: string; delta: string }
  | { type: 'ui.state'; domain: 'general'; moodScore: number; sectionScores: { general: number } }
  | { type: 'message.complete'; id: string; content: string }
  | { type: 'error'; code: string; message: string }

function toSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(request: Request): Promise<Response> {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
  }

  const rate = checkRateLimit({
    key: `chat-send:${userId}:${getClientIp(request)}`,
    max: 30,
  })

  if (!rate.ok) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(rate.retryAfterSec),
        },
      },
    )
  }

  let parsedBody: z.infer<typeof requestSchema>
  try {
    const body = (await request.json()) as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
    }
    parsedBody = parsed.data
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body')
  }

  const assistantId = crypto.randomUUID()
  const responseText = `Ricevuto: ${parsedBody.message}`
  const chunks = responseText.match(/.{1,16}/g) ?? [responseText]

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(toSse({ type: 'message.delta', id: assistantId, delta: chunk })))
        }

        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'ui.state',
              domain: 'general',
              moodScore: 50,
              sectionScores: { general: 50 },
            }),
          ),
        )

        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'message.complete',
              id: assistantId,
              content: responseText,
            }),
          ),
        )
      } catch {
        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Stream failure',
            }),
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
}
