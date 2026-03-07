import { describe, expect, it } from 'vitest'
import { parseServerEnv } from '@/lib/validators/env'

describe('server env validation', () => {
  it('allows test env without production secrets', () => {
    const env = parseServerEnv({ NODE_ENV: 'test' })
    expect(env.NODE_ENV).toBe('test')
  })

  it('throws in production when GEMINI_API_KEY is missing', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production', NEXTAUTH_SECRET: 'secret' })).toThrow(
      'Missing GEMINI_API_KEY in production',
    )
  })

  it('throws in production when NEXTAUTH_SECRET is missing', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production', GEMINI_API_KEY: 'k' })).toThrow(
      'Missing NEXTAUTH_SECRET in production',
    )
  })
})
