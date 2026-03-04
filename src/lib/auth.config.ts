import type { NextAuthConfig } from 'next-auth'

/**
 * Auth config without providers that use Node.js APIs.
 * Used by the Edge middleware (cannot import prisma/bcrypt).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtected = nextUrl.pathname.startsWith('/profile')
      if (isProtected && !isLoggedIn) {
        return false // redirects to signIn page
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  providers: [], // added in auth.ts with full Node.js providers
} satisfies NextAuthConfig
