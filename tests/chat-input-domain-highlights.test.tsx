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

  it('lights all active domains when the canonical state is multi-domain and switches when the primary domain changes', () => {
    const { rerender } = render(
      <ChatInput onSend={vi.fn()} activeDomain="health" activeDomains={['health', 'training']} />,
    )

    expect(screen.getByLabelText('Salute')).toHaveAttribute('data-active-domain', 'true')
    expect(screen.getByLabelText('Allenamento')).toHaveAttribute('data-active-domain', 'true')
    expect(screen.getByLabelText('Nutrizione')).toHaveAttribute('data-active-domain', 'false')

    rerender(
      <ChatInput onSend={vi.fn()} activeDomain="mindfulness" activeDomains={['mindfulness']} />,
    )

    expect(screen.getByLabelText('Mindfulness')).toHaveAttribute('data-active-domain', 'true')
    expect(screen.getByLabelText('Salute')).toHaveAttribute('data-active-domain', 'false')
    expect(screen.getByLabelText('Allenamento')).toHaveAttribute('data-active-domain', 'false')
  })
})
