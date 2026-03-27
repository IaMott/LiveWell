import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

/**
 * Central proxy — protects all app routes automatically.
 *
 * Uses the Edge-compatible authConfig (no Prisma, no bcrypt).
 * The `authorized` callback in auth.config.ts decides which paths
 * require a session and which are public (login, register, /api/auth/*).
 */
export default NextAuth(authConfig).auth

export const config = {
  /**
   * Run on every route except:
   * - Next.js internals (_next/static, _next/image)
   * - Favicon and static files with extensions (.ico, .png, .svg, etc.)
   *
   * This ensures all app pages and API routes are covered.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
