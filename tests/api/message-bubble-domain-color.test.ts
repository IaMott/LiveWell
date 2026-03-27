// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageBubble } from '@/components/chat/MessageBubble'

describe('MessageBubble domain coloring', () => {
  it('uses the active domain color for assistant bubbles even when the message metadata has no explicit domain yet', () => {
    render(
      React.createElement(MessageBubble, {
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Valutazione del caso in corso',
          specialistName: 'Fisiatra',
          streaming: false,
        },
        activeDomain: 'training',
      }),
    )

    const bubble = screen.getByTestId('assistant-bubble')
    expect(bubble).toHaveAttribute('data-domain', 'training')
    expect(bubble).toHaveStyle({
      backgroundColor: 'rgba(0, 122, 255, 0.14)',
    })
    expect(screen.getByText('Fisiatra')).toHaveStyle({ color: '#007AFF' })
  })
})
