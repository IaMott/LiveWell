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
 *
 * Auto-repair (dev only): if the JWT user ID is not found in DB, the
 * function recreates the user row so FK constraints don't block chat
 * persistence. Disabled in production (C4).
 */
export async function getAuthUserId(request?: Request): Promise<string | null> {
  // F1: Test-mode header bypass is guarded by BOTH NODE_ENV and an explicit opt-in flag.
  // This prevents accidental bypass if NODE_ENV is misconfigured in a staging/production deploy.
  // The flag AUTH_ALLOW_TEST_HEADERS must be explicitly set to 'true' AND NODE_ENV must be 'test'.
  const allowTestHeaders =
    process.env.NODE_ENV === 'test' && process.env.AUTH_ALLOW_TEST_HEADERS === 'true'
  if (allowTestHeaders && request) {
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
        // C4: Auto-repair is restricted to non-production — in production a missing
        // user means the DB was reset and the user must re-register.
        if (process.env.NODE_ENV === 'production') {
          return null
        }
        // Recreate user preserving the JWT id so the session stays valid (dev only)
        await prisma.user.create({
          data: {
            id: userId,
            email,
            name: session?.user?.name ?? null,
            passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
            // C4: Always force USER role — never copy elevated roles from JWT.
            role: 'USER',
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
  const allowTestHeaders =
    process.env.NODE_ENV === 'test' && process.env.AUTH_ALLOW_TEST_HEADERS === 'true'
  if (allowTestHeaders && request) {
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
  // F1: Same double-guard pattern as getAuthUserId / getAuthRole.
  const allowTestHeaders =
    process.env.NODE_ENV === 'test' && process.env.AUTH_ALLOW_TEST_HEADERS === 'true'
  if (allowTestHeaders && request) {
    const v = request.headers.get('x-owner-mode-enabled')
    return v === '1' || v === 'true'
  }
  // Owner mode requires explicit activation (future: UI toggle + session flag)
  return false
}
