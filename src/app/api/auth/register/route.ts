import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { errorResponse } from '@/lib/security/errorSchema'

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
})

export async function POST(request: Request): Promise<Response> {
  const rate = checkRateLimit({
    key: `register:${getClientIp(request)}`,
    max: 5,
  })
  if (!rate.ok) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many registration attempts')
  }

  let body: z.infer<typeof registerSchema>
  try {
    const raw = (await request.json()) as unknown
    const parsed = registerSchema.safeParse(raw)
    if (!parsed.success) {
      return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
    }
    body = parsed.data
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body')
  }

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true },
  })
  if (existing) {
    return errorResponse(409, 'CONFLICT', 'Email already registered')
  }

  const passwordHash = await bcrypt.hash(body.password, 12)
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name ?? null,
    },
    select: { id: true, email: true, name: true },
  })

  return Response.json({ user }, { status: 201 })
}
