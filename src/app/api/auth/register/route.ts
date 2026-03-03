import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

const registerSchema = z.object({
  email: z.string().email('Email non valida').max(255),
  password: z
    .string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .max(128, 'Password troppo lunga'),
  name: z.string().min(1, 'Il nome è obbligatorio').max(100).optional(),
})

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit: 5 registrations per minute per IP (strict)
  const ip = getClientIp(request)
  const rl = rateLimit(`register:${ip}`, { max: 5 })
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  try {
    const body = await request.json()
    const result = registerSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      )
    }

    const { email, password, name } = result.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Un account con questa email esiste già' },
        { status: 409 },
      )
    }

    const passwordHash = await hash(password, 12)

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 },
    )
  }
}
