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

  it('does not leak GEMINI_API_KEY in response payload', async () => {
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
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('test-secret-key')
    expect(body.apiKey).toBeUndefined()
  })
})
