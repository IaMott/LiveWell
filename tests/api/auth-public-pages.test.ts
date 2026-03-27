import { describe, expect, it } from 'vitest'
import { authConfig } from '@/lib/auth.config'

describe('auth public pages', () => {
  const authorized = authConfig.callbacks?.authorized

  it('keeps forgot-password public', () => {
    expect(
      authorized?.({
        auth: null,
        request: { nextUrl: new URL('https://livewell.mottisi.com/forgot-password') },
      } as never),
    ).toBe(true)
  })

  it('keeps reset-password public', () => {
    expect(
      authorized?.({
        auth: null,
        request: {
          nextUrl: new URL('https://livewell.mottisi.com/reset-password?token=abc'),
        },
      } as never),
    ).toBe(true)
  })

  it('still protects app routes when unauthenticated', () => {
    expect(
      authorized?.({
        auth: null,
        request: { nextUrl: new URL('https://livewell.mottisi.com/settings') },
      } as never),
    ).toBe(false)
  })
})
