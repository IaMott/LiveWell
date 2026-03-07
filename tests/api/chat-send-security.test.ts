import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/chat/send/route'

describe('/api/chat/send security baseline', () => {
  it('returns 401 without auth header', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ciao' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid payload', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u1',
      },
      body: JSON.stringify({ message: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('streams SSE with baseline event schema', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'u1',
      },
      body: JSON.stringify({ message: 'hello world' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')

    const text = await res.text()
    expect(text).toContain('"type":"message.delta"')
    expect(text).toContain('"type":"ui.state"')
    expect(text).toContain('"type":"message.complete"')
    expect(text).not.toContain('"apiKey"')
  })
})
