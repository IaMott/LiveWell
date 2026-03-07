import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/chat/send/route'

type ToolResultEvent = {
  type: 'tool.result'
  toolCallId: string
  ok: boolean
  code?: string
  message?: string
  requiresUserConfirmation?: boolean
  confirmToken?: string
}

function parseSseEvents(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>)
}

function firstToolResult(events: Array<Record<string, unknown>>): ToolResultEvent {
  const found = events.find((event) => event.type === 'tool.result')
  expect(found).toBeTruthy()
  return found as unknown as ToolResultEvent
}

function baseHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-id': 'u-owner',
    'x-user-role': 'OWNER',
    'x-owner-mode-enabled': 'true',
    ...(extra ?? {}),
  }
}

describe('/api/chat/send confirm token two-step flow', () => {
  it('blocks destructive tool for non-owner role', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders({ 'x-user-role': 'USER' }),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r0"}',
      }),
    })

    const res = await POST(req)
    const body = await res.text()
    const event = firstToolResult(parseSseEvents(body))

    expect(event.ok).toBe(false)
    expect(event.code).toBe('FORBIDDEN')
  })

  it('blocks destructive tool when owner mode is disabled', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders({ 'x-owner-mode-enabled': 'false' }),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r0b"}',
      }),
    })

    const res = await POST(req)
    const body = await res.text()
    const event = firstToolResult(parseSseEvents(body))

    expect(event.ok).toBe(false)
    expect(event.code).toBe('OWNER_MODE_REQUIRED')
  })

  it('returns confirmation required for destructive tool without explicit confirmation', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r1"}',
      }),
    })

    const res = await POST(req)
    const body = await res.text()
    const event = firstToolResult(parseSseEvents(body))

    expect(event.ok).toBe(false)
    expect(event.code).toBe('CONFIRMATION_REQUIRED')
    expect(event.requiresUserConfirmation).toBe(true)
    expect(typeof event.confirmToken).toBe('string')
  })

  it('returns missing confirmation error when confirmedByUser=true but token is absent', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r2"}',
        confirmedByUser: true,
      }),
    })

    const res = await POST(req)
    const body = await res.text()
    const event = firstToolResult(parseSseEvents(body))

    expect(event.ok).toBe(false)
    expect(event.code).toBe('CONFIRMATION_REQUIRED')
  })

  it('returns invalid confirm token when token does not exist', async () => {
    const req = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r3"}',
        confirmedByUser: true,
        confirmToken: 'invalid-token',
      }),
    })

    const res = await POST(req)
    const body = await res.text()
    const event = firstToolResult(parseSseEvents(body))

    expect(event.ok).toBe(false)
    expect(event.code).toBe('INVALID_CONFIRM_TOKEN')
  })

  it('rejects token reuse after first successful consumption', async () => {
    const issueReq = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r4"}',
      }),
    })
    const issueRes = await POST(issueReq)
    const issueBody = await issueRes.text()
    const issueEvent = firstToolResult(parseSseEvents(issueBody))
    expect(issueEvent.confirmToken).toBeTruthy()

    const consumeReq = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r4"}',
        confirmedByUser: true,
        confirmToken: issueEvent.confirmToken,
      }),
    })
    const consumeRes = await POST(consumeReq)
    const consumeBody = await consumeRes.text()
    const consumeEvent = firstToolResult(parseSseEvents(consumeBody))
    expect(consumeEvent.ok).toBe(true)

    const reuseReq = new Request('http://localhost/api/chat/send', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        message: '/tool share.createLink {"resourceType":"recipe","resourceId":"r4"}',
        confirmedByUser: true,
        confirmToken: issueEvent.confirmToken,
      }),
    })
    const reuseRes = await POST(reuseReq)
    const reuseBody = await reuseRes.text()
    const reuseEvent = firstToolResult(parseSseEvents(reuseBody))

    expect(reuseEvent.ok).toBe(false)
    expect(reuseEvent.code).toBe('INVALID_CONFIRM_TOKEN')
  })
})
