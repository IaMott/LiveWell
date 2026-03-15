import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authConfig } from './auth.config'
import type { Role } from '@/lib/ai/types'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, passwordHash: true, role: true },
        })
        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        }
      },
    }),
  ],
})

/**
 * Returns the authenticated userId for a route handler.
 *
 * In test environment (NODE_ENV=test): reads from x-user-id header
 * for unit test compatibility.
 * In production: reads from NextAuth JWT session (cookie-based).
 */
/**
 * Returns the authenticated userId for a route handler.
 *
 * In test environment (NODE_ENV=test): reads from x-user-id header
 * for unit test compatibility.
 * In production: reads from NextAuth JWT session (cookie-based).
 *
 * Auto-repair: if the JWT user ID is not found in DB (e.g. after a DB
 * migration that wiped user records), the function recreates the user
 * row from session data so FK constraints don't block chat persistence.
 */
export async function getAuthUserId(request?: Request): Promise<string | null> {
  if (process.env.NODE_ENV === 'test' && request) {
    return request.headers.get('x-user-id')?.trim() || null
  }
  const session = await auth()
  const userId = session?.user?.id ?? null
  if (!userId) return null

  // Fast-path: check DB record exists, auto-recreate if missing
  try {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!exists) {
      const email = session?.user?.email
      if (email) {
        // Check if another record already holds this email (DB was reset with new IDs)
        const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
        if (byEmail) {
          // Different DB id — return the current DB id so FK constraints work
          return byEmail.id
        }
        // Recreate user preserving the JWT id so the session stays valid
        await prisma.user.create({
          data: {
            id: userId,
            email,
            name: session?.user?.name ?? null,
            // Random hash — user logs in via existing JWT; can reset password later
            passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
            role: (session?.user?.role as 'USER' | 'ADMIN' | 'OWNER') ?? 'USER',
          },
        })
      }
    }
  } catch {
    // Non-fatal: worst case the FK will fail on the next write (same as before)
  }

  return userId
}

/**
 * Returns the role for the authenticated user.
 *
 * In test environment: reads from x-user-role header.
 * In production: reads from JWT session.
 */
export async function getAuthRole(request?: Request): Promise<Role> {
  if (process.env.NODE_ENV === 'test' && request) {
    const role = request.headers.get('x-user-role')?.trim()
    if (role === 'OWNER' || role === 'ADMIN' || role === 'USER') return role
    return 'USER'
  }
  const session = await auth()
  const role = session?.user?.role
  if (role === 'OWNER' || role === 'ADMIN') return role
  return 'USER'
}

/**
 * Returns whether owner mode is enabled for the current request.
 *
 * In test environment: reads from x-owner-mode-enabled header.
 * In production: always false unless explicitly set via secure mechanism.
 */
export async function getAuthOwnerMode(request?: Request): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && request) {
    const v = request.headers.get('x-owner-mode-enabled')
    return v === '1' || v === 'true'
  }
  // Owner mode requires explicit activation (future: UI toggle + session flag)
  return false
}
