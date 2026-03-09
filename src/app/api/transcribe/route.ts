import { GoogleGenAI } from '@google/genai'
import { getAuthUserId } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { errorResponse } from '@/lib/security/errorSchema'
import { getServerEnv } from '@/lib/validators/env'

// Maximum audio size: 10 MB
const MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
])

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
  }

  const rate = checkRateLimit({
    key: `transcribe:${userId}:${getClientIp(request)}`,
    max: 20,
  })
  if (!rate.ok) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many requests')
  }

  const env = getServerEnv()
  if (!env.GEMINI_API_KEY) {
    return errorResponse(503, 'UNAVAILABLE', 'Transcription not available: missing API key')
  }

  let file: File | null = null
  try {
    const form = await request.formData()
    file = form.get('file') as File | null
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Could not parse form data')
  }

  if (!file) {
    return errorResponse(400, 'BAD_REQUEST', 'Missing audio file')
  }

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) {
    return errorResponse(400, 'BAD_REQUEST', 'Audio file exceeds 10 MB limit')
  }
  if (bytes.byteLength < 500) {
    // Too small to contain real audio
    return new Response(JSON.stringify({ text: '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Normalise MIME type (strip codec suffix for Gemini if needed)
  const rawMime = file.type || 'audio/webm'
  const mimeType = ALLOWED_MIME.has(rawMime) ? rawMime : 'audio/webm'

  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
    const base64Data = Buffer.from(bytes).toString('base64')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: 'Trascrivi esattamente le parole dette in questo audio, in italiano. Rispondi SOLO con la trascrizione verbatim — nessuna parola aggiuntiva, nessuna spiegazione, nessuna punteggiatura extra oltre a quella parlata.',
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        maxOutputTokens: 512,
      },
    })

    const text = (response.text ?? '').trim()
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[api/transcribe] Gemini error:', err)
    return errorResponse(500, 'INTERNAL_ERROR', 'Audio transcription failed')
  }
}
