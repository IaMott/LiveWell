import { describe, expect, it } from 'vitest'
import { buildResetPasswordUrl } from '@/app/api/auth/forgot-password/route'

describe('buildResetPasswordUrl', () => {
  it('trims NEXT_PUBLIC_APP_URL and builds a valid reset link', () => {
    const out = buildResetPasswordUrl({
      appUrlEnv: 'https://livewell.mottisi.com\n',
      requestUrl: 'https://livewell.mottisi.com/api/auth/forgot-password',
      token: 'abc.def.ghi',
    })

    expect(out).toBe('https://livewell.mottisi.com/reset-password?token=abc.def.ghi')
  })

  it('falls back to request origin when env URL is invalid', () => {
    const out = buildResetPasswordUrl({
      appUrlEnv: 'not-a-valid-url',
      requestUrl: 'https://livewell.mottisi.com/api/auth/forgot-password',
      token: 'token123',
    })

    expect(out).toBe('https://livewell.mottisi.com/reset-password?token=token123')
  })
})
