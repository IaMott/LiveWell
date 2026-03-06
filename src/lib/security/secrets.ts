import { getServerEnv } from '@/lib/validators/env'

const SERVER_ONLY_KEYS = ['GEMINI_API_KEY', 'NEXTAUTH_SECRET'] as const

export function getServerSecret(key: (typeof SERVER_ONLY_KEYS)[number]): string | undefined {
  const env = getServerEnv()
  return env[key]
}

export function assertNoSecretLeak(payload: unknown): void {
  const serialized = JSON.stringify(payload)
  if (!serialized) return

  const env = getServerEnv()
  for (const key of SERVER_ONLY_KEYS) {
    const value = env[key]
    if (value && serialized.includes(value)) {
      throw new Error(`Secret leakage detected for ${key}`)
    }
  }
}
