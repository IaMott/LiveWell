// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatInput } from '@/components/chat/ChatInput'

vi.mock('@/components/chat/live/LiveModal', () => ({
  LiveModal: () => null,
}))

describe('ChatInput domain highlights', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('lights all active domains in multi-domain mode and switches when the active domain changes', () => {
    const { rerender } = render(
      React.createElement(ChatInput, {
        onSend: vi.fn(),
        activeDomain: 'health',
        activeDomains: ['health', 'training'],
      }),
    )

    expect(screen.getByLabelText('Salute')).toHaveAttribute('data-active-domain', 'true')
    expect(screen.getByLabelText('Allenamento')).toHaveAttribute('data-active-domain', 'true')
    expect(screen.getByLabelText('Nutrizione')).toHaveAttribute('data-active-domain', 'false')

    rerender(
      React.createElement(ChatInput, {
        onSend: vi.fn(),
        activeDomain: 'mindfulness',
        activeDomains: ['mindfulness'],
      }),
    )

    expect(screen.getByLabelText('Mindfulness')).toHaveAttribute('data-active-domain', 'true')
    expect(screen.getByLabelText('Salute')).toHaveAttribute('data-active-domain', 'false')
    expect(screen.getByLabelText('Allenamento')).toHaveAttribute('data-active-domain', 'false')
  })
})
