import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatInput } from '@/components/chat/ChatInput'

vi.mock('@/components/chat/live/LiveModal', () => ({
  LiveModal: (props: {
    onTranscription?: (role: 'user' | 'assistant', text: string) => void
    onClose: () => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() => props.onTranscription?.('user', 'Sono qui per stare meglio')}
      >
        emit-user
      </button>
      <button
        type="button"
        onClick={() => props.onTranscription?.('assistant', 'Ti aiuto a impostare il percorso')}
      >
        emit-assistant
      </button>
      <button type="button" onClick={props.onClose}>
        close-live
      </button>
    </div>
  ),
}))

describe('ChatInput live transcript ordering', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('serializes transcript persistence so the assistant turn waits for the user turn write', async () => {
    const onLiveMessage = vi.fn()
    const stateSnapshot = {
      schemaVersion: 1,
      conversationId: 'conv-live-1',
      activeDomains: ['health'],
      domainPanels: [
        {
          domain: 'health',
          selectedAgentId: 'fisioterapista',
          candidateAgentIds: ['fisioterapista'],
          status: 'active',
          priorityScore: 0.9,
          lastReasoningAt: null,
          pendingNeeds: [],
        },
      ],
      leadDomain: 'health',
      speakerPolicy: 'lead',
      conversationFocus: {
        activeProblems: ['dolore spalla'],
        activeGoals: ['allenarmi bene'],
        activeConstraints: [],
        summary: 'live turn',
      },
      coordinationState: {
        crossDomainConflicts: [],
        dependencies: [],
        needsReview: false,
      },
      sharedOpenQuestions: [],
      domainOpenQuestions: {},
      updatedAt: '2026-03-27T20:30:00.000Z',
    }

    let resolveUserTranscript: ((response: Response) => void) | null = null
    const userTranscriptPromise = new Promise<Response>((resolve) => {
      resolveUserTranscript = resolve
    })

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/chat/transcript') {
        const body = JSON.parse(String(init?.body)) as {
          messages: Array<{ role: 'user' | 'assistant'; content: string }>
        }
        const role = body.messages[0]?.role
        if (role === 'user') {
          return userTranscriptPromise
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              conversationId: 'conv-live-1',
              savedMessages: body.messages,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      if (url === '/api/chat/live-sync') {
        return Promise.resolve(
          new Response(JSON.stringify({ stateSnapshot }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    })

    global.fetch = fetchMock as typeof global.fetch

    render(
      <ChatInput onSend={vi.fn()} conversationId="conv-live-1" onLiveMessage={onLiveMessage} />,
    )

    fireEvent.click(screen.getByLabelText('Sessione live'))
    fireEvent.click(screen.getByText('emit-user'))
    fireEvent.click(screen.getByText('emit-assistant'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    resolveUserTranscript?.(
      new Response(
        JSON.stringify({
          ok: true,
          conversationId: 'conv-live-1',
          savedMessages: [{ role: 'user', content: 'Sono qui per stare meglio' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    const liveSyncCall = fetchMock.mock.calls[1]
    const assistantTranscriptCall = fetchMock.mock.calls[2]
    expect(String(liveSyncCall?.[0])).toBe('/api/chat/live-sync')
    expect(String(assistantTranscriptCall?.[0])).toBe('/api/chat/transcript')

    const assistantBody = JSON.parse(String(assistantTranscriptCall?.[1]?.body)) as {
      messages: Array<{ role: string; specialistName?: string }>
    }
    expect(assistantBody.messages[0]).toMatchObject({
      role: 'assistant',
      specialistName: 'Fisioterapista',
    })
    expect(onLiveMessage.mock.calls.map((call) => call[0].role)).toEqual(['user', 'assistant'])
  })
})
