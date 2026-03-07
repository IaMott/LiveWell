import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { errorResponse } from '@/lib/security/errorSchema'
import { getAuthUserId } from '@/lib/auth'
import { assertNoSecretLeak, getServerSecret } from '@/lib/security/secrets'
import { getServerEnv } from '@/lib/validators/env'

const requestSchema = z.object({
  conversationId: z.string().min(1).optional(),
})

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
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
    parsedBody = {}
  }

  const env = getServerEnv()
  const hasLiveAccess = Boolean(getServerSecret('GEMINI_API_KEY'))

  if (!hasLiveAccess) {
    return errorResponse(503, 'UNAVAILABLE', 'Live service not available')
  }

  const expiresInSec = 60
  const now = Date.now()
  const payload = {
    sessionToken: randomUUID(),
    model: env.LIVE_MODEL,
    expiresAt: new Date(now + expiresInSec * 1000).toISOString(),
    conversationId: parsedBody.conversationId ?? null,
  }

  assertNoSecretLeak(payload)

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
