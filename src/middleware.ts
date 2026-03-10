import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

// Edge-compatible middleware: only uses authConfig (no prisma/bcrypt)
export default auth(() => {})

export const config = {
  // Only protect page routes via middleware.
  // API routes handle auth themselves via getAuthUserId() in each handler.
  matcher: ['/profile/:path*'],
}
