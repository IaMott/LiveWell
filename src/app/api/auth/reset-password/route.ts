import { z } from 'zod'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { errorResponse } from '@/lib/security/errorSchema'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
})

export async function POST(request: Request): Promise<Response> {
  const rate = checkRateLimit({
    key: `reset-pw:${getClientIp(request)}`,
    max: 10,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  let body: z.infer<typeof schema>
  try {
    const raw = (await request.json()) as unknown
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'BAD_REQUEST', 'Invalid request')
    body = parsed.data
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON')
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return errorResponse(500, 'INTERNAL_ERROR', 'Auth not configured')

  let userId: string
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(body.token, key)
    if (payload.purpose !== 'reset' || typeof payload.sub !== 'string') {
      return errorResponse(400, 'BAD_REQUEST', 'Invalid token')
    }
    userId = payload.sub
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Link non valido o scaduto. Richiedi un nuovo link.')
  }

  const passwordHash = await bcrypt.hash(body.password, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  return Response.json({ ok: true })
}
