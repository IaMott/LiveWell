import { z } from 'zod'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { errorResponse } from '@/lib/security/errorSchema'

const schema = z.object({ email: z.string().email().max(255) })

function normalizeBaseUrl(raw: string | undefined, requestUrl: string): string {
  const fallback = new URL(requestUrl).origin
  const candidate = raw?.trim()
  if (!candidate) return fallback
  try {
    return new URL(candidate).origin
  } catch {
    return fallback
  }
}

export function buildResetPasswordUrl(input: {
  appUrlEnv?: string
  requestUrl: string
  token: string
}): string {
  const baseUrl = normalizeBaseUrl(input.appUrlEnv, input.requestUrl)
  return `${baseUrl}/reset-password?token=${encodeURIComponent(input.token)}`
}

export async function POST(request: Request): Promise<Response> {
  const rate = checkRateLimit({
    key: `forgot-pw:${getClientIp(request)}`,
    max: 5,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: z.infer<typeof schema>
  try {
    const raw = (await request.json()) as unknown
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid email')
    body = parsed.data
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  // Always return 200 — never reveal whether an email is registered
  const user = await prisma.user
    .findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true },
    })
    .catch(() => null)

  if (user) {
    const secret = process.env.NEXTAUTH_SECRET
    if (secret) {
      const key = new TextEncoder().encode(secret)
      const token = await new SignJWT({ sub: user.id, email: user.email, purpose: 'reset' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(key)

      const resetUrl = buildResetPasswordUrl({
        appUrlEnv: process.env.NEXT_PUBLIC_APP_URL,
        requestUrl: request.url,
        token,
      })

      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'LiveWell <noreply@livewell.mottisi.com>',
            to: user.email,
            subject: 'Recupero password LiveWell',
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">LiveWell</h2>
                <p style="color: #8E8E93; margin-bottom: 1.5rem;">Recupero password</p>
                <p>Ciao${user.name ? ` ${user.name}` : ''},</p>
                <p>Hai richiesto di reimpostare la password del tuo account LiveWell.</p>
                <p>Clicca il pulsante qui sotto per creare una nuova password. Il link è valido per 1 ora.</p>
                <a href="${resetUrl}"
                   style="display: inline-block; margin: 1.5rem 0; padding: 0.875rem 1.5rem;
                          background: #1C1C1E; color: #fff; border-radius: 0.75rem;
                          text-decoration: none; font-weight: 600;">
                  Reimposta password
                </a>
                <p style="color: #8E8E93; font-size: 0.875rem;">
                  Se non hai richiesto il recupero password, ignora questa email.
                </p>
              </div>
            `,
          }),
        }).catch((err) => console.error('[forgot-password] resend error', err))
      } else {
        // Dev fallback: log the reset URL
        console.log('[forgot-password] reset link (RESEND_API_KEY not set):', resetUrl)
      }
    }
  }

  return Response.json({ ok: true })
}
