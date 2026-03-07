// Vitest stub for next-auth — prevents next/server ESM resolution failure
// in Node.js forks pool. Route handlers use header-based auth in test mode.
const NextAuth = () => ({
  handlers: {},
  auth: async () => null,
  signIn: async () => undefined,
  signOut: async () => undefined,
})

export default NextAuth
