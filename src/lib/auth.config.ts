import type { NextAuthConfig, DefaultSession } from 'next-auth'

// Extend NextAuth session/user types to include id and role
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }
  interface User {
    role?: string
  }
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const isProtectedPage = nextUrl.pathname.startsWith('/profile')
      if (isProtectedPage) return isLoggedIn
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role ?? 'USER'
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string
        session.user.role = (token.role as string) ?? 'USER'
      }
      return session
    },
  },
  providers: [],
}
