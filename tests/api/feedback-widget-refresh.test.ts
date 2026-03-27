// @vitest-environment jsdom

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackWidget } from '@/components/chat/FeedbackWidget'

describe('FeedbackWidget refresh hydration', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('rehydrates an existing saved review after refresh instead of looking empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: {
          rating: 4,
          comment: 'Molto utile',
        },
      }),
    })

    render(
      React.createElement(FeedbackWidget, {
        messageId: 'assistant-1',
        conversationId: 'conv-1',
        agentName: 'Fisioterapista',
        domain: 'health',
      }),
    )

    await waitFor(() => expect(screen.getByText(/grazie per il feedback/i)).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalledWith('/api/feedback?messageId=assistant-1')
    expect(screen.getByLabelText('Valutazione salvata: 4 stelle')).toHaveTextContent('★★★★☆')
    expect(screen.getByText('“Molto utile”')).toBeInTheDocument()
  })
})
