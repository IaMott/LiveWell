/**
 * Normalise the ephemeral-token name returned by authTokens.create()
 * to the `auth_tokens/<id>` format expected by the Gemini SDK as apiKey.
 */
export function normalizeEphemeralToken(name: string): string {
  const t = name.trim()
  if (!t) return t
  if (t.startsWith('auth_tokens/')) return t
  if (t.startsWith('authTokens/')) return `auth_tokens/${t.slice('authTokens/'.length)}`
  const marker = '/authTokens/'
  const idx = t.indexOf(marker)
  if (idx >= 0) return `auth_tokens/${t.slice(idx + marker.length)}`
  return t
}
