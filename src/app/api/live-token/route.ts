import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { errorResponse } from '@/lib/security/errorSchema'
import { getAuthUserId } from '@/lib/auth'
import { getServerSecret } from '@/lib/security/secrets'
import { getServerEnv } from '@/lib/validators/env'

const requestSchema = z.object({
  conversationId: z.string().min(1).optional(),
})

const toIsoInMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString()

/**
 * Normalise the ephemeral-token name returned by authTokens.create()
 * to the `auth_tokens/<id>` format expected by the SDK as apiKey.
 */
function normalizeEphemeralToken(name: string): string {
  const t = name.trim()
  if (!t) return t
  if (t.startsWith('auth_tokens/')) return t
  if (t.startsWith('authTokens/')) return `auth_tokens/${t.slice('authTokens/'.length)}`
  const marker = '/authTokens/'
  const idx = t.indexOf(marker)
  if (idx >= 0) return `auth_tokens/${t.slice(idx + marker.length)}`
  return t
}

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

  const apiKey = getServerSecret('GEMINI_API_KEY')
  if (!apiKey) {
    return errorResponse(503, 'UNAVAILABLE', 'Live service not available')
  }

  const env = getServerEnv()

  try {
    // v1alpha is required for ephemeral token creation
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1alpha',
      httpOptions: { apiVersion: 'v1alpha' },
    } as ConstructorParameters<typeof GoogleGenAI>[0])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenClient = (ai as any).authTokens ?? (ai as any).tokens
    if (typeof tokenClient?.create !== 'function') {
      throw new Error('authTokens.create not available in this SDK version')
    }

    const ephemeral = (await tokenClient.create({
      config: {
        uses: 3,
        newSessionExpireTime: toIsoInMinutes(10),
        expireTime: toIsoInMinutes(40),
      },
    })) as { name?: string }

    const rawName = ephemeral?.name ?? ''
    if (!rawName) throw new Error('Empty ephemeral token received from Gemini')

    const token = normalizeEphemeralToken(rawName)

    return new Response(
      JSON.stringify({
        token,
        model: env.LIVE_MODEL,
        expiresAt: toIsoInMinutes(40),
        conversationId: parsedBody.conversationId ?? null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to create live session token'
    return errorResponse(503, 'UNAVAILABLE', msg)
  }
}
