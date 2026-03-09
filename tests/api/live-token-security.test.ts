import { beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/live-token/route'
import { resetServerEnvForTests } from '@/lib/validators/env'

describe('/api/live-token security baseline', () => {
  const oldEnv = process.env

  beforeEach(() => {
    process.env = { ...oldEnv }
    process.env.NODE_ENV = 'test'
    process.env.GEMINI_API_KEY = 'test-secret-key'
    process.env.LIVE_MODEL = 'gemini-2.0-flash-live'
    resetServerEnvForTests()
  })

  it('returns 401 without authentication header', async () => {
    const req = new Request('http://localhost/api/live-token', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns apiKey to authenticated users (intentional — endpoint is auth-protected)', async () => {
    const req = new Request('http://localhost/api/live-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u1',
      },
      body: JSON.stringify({ conversationId: 'c1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.sessionToken).toBeTypeOf('string')
    expect(body.model).toBe('gemini-2.0-flash-live')
    // apiKey is intentionally returned to authenticated users so the browser
    // can open a direct WebSocket to the Gemini Live API.
    // The endpoint requires a valid session cookie — unauthenticated requests
    // receive 401 (verified above).
    expect(body.apiKey).toBeTypeOf('string')
    expect(body.apiKey).toBe('test-secret-key')
  })
})
