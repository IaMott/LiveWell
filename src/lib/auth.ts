import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authConfig } from './auth.config'
import type { Role } from '@/lib/ai/types'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
})

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
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
export async function getAuthUserId(request?: Request): Promise<string | null> {
  if (process.env.NODE_ENV === 'test' && request) {
    return request.headers.get('x-user-id')?.trim() || null
  }
  const session = await auth()
  return session?.user?.id ?? null
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
