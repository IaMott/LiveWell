import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatProvider } from '@/contexts/ChatContext'
import { useChat } from '@/hooks/useChat'

function LiveAppendHarness() {
  const { conversationId, appendLiveMessage } = useChat()

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          appendLiveMessage({
            role: 'user',
            text: 'Messaggio live confermato',
            conversationId: 'conv-live-77',
          })
        }
      >
        append-live
      </button>
      <span data-testid="conversation-id">{conversationId ?? 'none'}</span>
    </div>
  )
}

function SendHarness() {
  const { send, messages } = useChat()

  return (
    <div>
      <button type="button" onClick={() => void send('Ho dolore al ginocchio')}>
        send
      </button>
      <pre data-testid="messages">{JSON.stringify(messages)}</pre>
    </div>
  )
}

describe('ChatContext live runtime guards', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('syncs a live-created conversation id into the global chat context for refresh/export', async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/conversations') {
        return Promise.resolve(
          new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }) as typeof global.fetch

    render(
      <ChatProvider>
        <LiveAppendHarness />
      </ChatProvider>,
    )

    fireEvent.click(screen.getByText('append-live'))

    await waitFor(() => {
      expect(screen.getByTestId('conversation-id').textContent).toBe('conv-live-77')
    })

    expect(window.localStorage.getItem('livewell_conversation_id')).toBe('conv-live-77')
  })

  it('does not expose a predicted specialist on the streaming message before completion', async () => {
    const encoder = new TextEncoder()
    let releaseComplete: (() => void) | null = null
    const completeGate = new Promise<void>((resolve) => {
      releaseComplete = resolve
    })

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/conversations') {
        return Promise.resolve(
          new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      if (url === '/api/chat/send') {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'ui.state',
                  domain: 'health',
                  specialistName: 'Fisioterapista',
                  activeSpecialistId: 'fisioterapista',
                  stateSnapshot: {
                    schemaVersion: 1,
                    conversationId: 'conv-stream-1',
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
                      activeProblems: ['dolore ginocchio'],
                      activeGoals: [],
                      activeConstraints: [],
                      summary: 'focus salute',
                    },
                    coordinationState: {
                      crossDomainConflicts: [],
                      dependencies: [],
                      needsReview: false,
                    },
                    sharedOpenQuestions: [],
                    domainOpenQuestions: {},
                    updatedAt: '2026-03-27T23:55:00.000Z',
                  },
                  conversationId: 'conv-stream-1',
                })}\n\n`,
              ),
            )

            void completeGate.then(() => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'message.complete',
                    id: 'assistant-server-1',
                    content: 'Ti aiuto a capire il problema al ginocchio.',
                  })}\n\n`,
                ),
              )
              controller.close()
            })
          },
        })

        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }) as typeof global.fetch

    render(
      <ChatProvider>
        <SendHarness />
      </ChatProvider>,
    )

    fireEvent.click(screen.getByText('send'))

    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toContain('"domain":"health"')
    })

    expect(screen.getByTestId('messages').textContent).not.toContain('Fisioterapista')

    releaseComplete?.()

    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toContain('Fisioterapista')
    })
  })
})
