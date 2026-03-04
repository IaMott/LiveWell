import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HistoryPageContent } from '../src/components/profile/pages/HistoryPageContent'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('HistoryPageContent', () => {
  const originalFetch = global.fetch
  const originalConfirm = window.confirm
  const originalAlert = window.alert

  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.confirm = vi.fn(() => true)
    window.alert = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    window.confirm = originalConfirm
    window.alert = originalAlert
  })

  it('elimina singola conversazione e resetta localStorage se attiva', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
            {
              id: 'c2',
              title: 'Chat 2',
              updatedAt: '2026-03-04T15:00:00.000Z',
              messages: [{ content: 'preview 2', role: 'assistant' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletedCount: 1 }),
      }) as typeof global.fetch

    window.localStorage.setItem('livewell_conversation_id', 'c1')
    render(<HistoryPageContent />)

    await screen.findByText('Chat 1')
    const deleteButtons = screen.getAllByRole('button', { name: 'Elimina conversazione' })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Chat 1')).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem('livewell_conversation_id')).toBeNull()
  })

  it('elimina tutto lo storico e resetta localStorage', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletedCount: 1 }),
      }) as typeof global.fetch

    window.localStorage.setItem('livewell_conversation_id', 'c1')
    render(<HistoryPageContent />)

    await screen.findByText('Chat 1')
    fireEvent.click(screen.getByRole('button', { name: /Elimina tutto lo storico/i }))

    await waitFor(() => {
      expect(screen.queryByText('Chat 1')).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem('livewell_conversation_id')).toBeNull()
  })

  it('non esegue delete singola se conferma annullata', async () => {
    window.confirm = vi.fn(() => false)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
          ],
        }),
      }) as unknown as typeof global.fetch
    global.fetch = fetchMock

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: 'Elimina conversazione' }))

    expect(fetchMock).toHaveBeenCalledTimes(1) // solo load iniziale
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('non esegue delete totale se conferma annullata', async () => {
    window.confirm = vi.fn(() => false)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
          ],
        }),
      }) as unknown as typeof global.fetch
    global.fetch = fetchMock

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: /Elimina tutto lo storico/i }))

    expect(fetchMock).toHaveBeenCalledTimes(1) // solo load iniziale
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('mostra alert e mantiene lista invariata su errore delete singola', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'boom' }),
      }) as unknown as typeof global.fetch
    global.fetch = fetchMock

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: 'Elimina conversazione' }))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled()
    })
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('mostra alert e mantiene lista invariata su errore delete totale', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'boom' }),
      }) as unknown as typeof global.fetch
    global.fetch = fetchMock

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: /Elimina tutto lo storico/i }))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled()
    })
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('blocca delete singola durante delete totale in corso', async () => {
    let resolveDeleteAll: (() => void) | null = null
    const deleteAllPromise = new Promise<{ ok: boolean; json: () => Promise<{ deletedCount: number }> }>((resolve) => {
      resolveDeleteAll = () =>
        resolve({
          ok: true,
          json: async () => ({ deletedCount: 1 }),
        })
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'c1',
              title: 'Chat 1',
              updatedAt: '2026-03-04T16:00:00.000Z',
              messages: [{ content: 'preview 1', role: 'assistant' }],
            },
          ],
        }),
      })
      .mockReturnValueOnce(deleteAllPromise) as unknown as typeof global.fetch
    global.fetch = fetchMock

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: /Elimina tutto lo storico/i }))

    const singleDeleteButton = screen.getByRole('button', { name: 'Elimina conversazione' }) as HTMLButtonElement
    expect(singleDeleteButton.disabled).toBe(true)

    resolveDeleteAll?.()
    await waitFor(() => {
      expect(screen.queryByText('Chat 1')).not.toBeInTheDocument()
    })
  })
})
