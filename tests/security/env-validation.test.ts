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

  it('parses ORCH_RETRY_GUARD_WINDOW_MS as positive integer when provided', () => {
    const env = parseServerEnv({ NODE_ENV: 'test', ORCH_RETRY_GUARD_WINDOW_MS: '45000' })
    expect(env.ORCH_RETRY_GUARD_WINDOW_MS).toBe(45000)
  })

  it('throws when ORCH_RETRY_GUARD_WINDOW_MS is invalid', () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: 'test', ORCH_RETRY_GUARD_WINDOW_MS: 'not-a-number' }),
    ).toThrow('Invalid server env')
  })
})
