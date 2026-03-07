// Test stub for @/lib/auth — avoids importing next-auth in Vitest's forks pool.
// Route handlers read x-user-id / x-user-role / x-owner-mode-enabled headers
// in NODE_ENV=test, so this stub is behaviourally equivalent.

export type Role = 'OWNER' | 'ADMIN' | 'USER'

export async function getAuthUserId(request?: Request): Promise<string | null> {
  return request?.headers.get('x-user-id')?.trim() || null
}

export async function getAuthRole(request?: Request): Promise<Role> {
  const role = request?.headers.get('x-user-role')?.trim() as Role | undefined
  if (role === 'OWNER' || role === 'ADMIN' || role === 'USER') return role
  return 'USER'
}

export async function getAuthOwnerMode(request?: Request): Promise<boolean> {
  const v = request?.headers.get('x-owner-mode-enabled')
  return v === '1' || v === 'true'
}

export const auth = async (): Promise<null> => null
export const handlers: Record<string, unknown> = {}
export const signIn = async (): Promise<undefined> => undefined
export const signOut = async (): Promise<undefined> => undefined
