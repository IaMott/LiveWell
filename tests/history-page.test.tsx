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

  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    global.fetch = originalFetch
    window.confirm = originalConfirm
  })

  function withBaseProfileHistory(fetchMock: ReturnType<typeof vi.fn>) {
    fetchMock.mockResolvedValueOnce({
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
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        timeline: [
          {
            id: 'h1',
            section: 'nutrition',
            timestamp: '2026-03-04T16:00:00.000Z',
            domain: 'nutrizione',
            primarySpecialist: 'dietista',
            contributors: [],
            userMessage: 'msg',
            assistantSummary: 'summary',
            attachments: [],
          },
        ],
        attachmentsBySection: {
          nutrition: [],
        },
      }),
    })
  }

  it('elimina singola conversazione e resetta localStorage se attiva', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
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
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ timeline: [], attachmentsBySection: {} }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deletedCount: 1 }),
    })
    global.fetch = fetchMock as typeof global.fetch

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
    const fetchMock = vi.fn()
    withBaseProfileHistory(fetchMock)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deletedCount: 1 }),
    })
    global.fetch = fetchMock as typeof global.fetch

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
    const fetchMock = vi.fn()
    withBaseProfileHistory(fetchMock)
    global.fetch = fetchMock as unknown as typeof global.fetch

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: 'Elimina conversazione' }))

    expect(fetchMock).toHaveBeenCalledTimes(2) // conversazioni + history
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('non esegue delete totale se conferma annullata', async () => {
    window.confirm = vi.fn(() => false)
    const fetchMock = vi.fn()
    withBaseProfileHistory(fetchMock)
    global.fetch = fetchMock as unknown as typeof global.fetch

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: /Elimina tutto lo storico/i }))

    expect(fetchMock).toHaveBeenCalledTimes(2) // conversazioni + history
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('mostra errore e mantiene lista invariata su errore delete singola', async () => {
    const fetchMock = vi.fn()
    withBaseProfileHistory(fetchMock)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'boom' }),
    })
    global.fetch = fetchMock as unknown as typeof global.fetch

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: 'Elimina conversazione' }))

    await waitFor(() => {
      expect(screen.getByText('Impossibile eliminare la conversazione. Riprova.')).toBeInTheDocument()
    })
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('mostra errore e mantiene lista invariata su errore delete totale', async () => {
    const fetchMock = vi.fn()
    withBaseProfileHistory(fetchMock)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'boom' }),
    })
    global.fetch = fetchMock as unknown as typeof global.fetch

    render(<HistoryPageContent />)
    await screen.findByText('Chat 1')

    fireEvent.click(screen.getByRole('button', { name: /Elimina tutto lo storico/i }))

    await waitFor(() => {
      expect(screen.getByText('Impossibile eliminare lo storico conversazioni. Riprova.')).toBeInTheDocument()
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

    const fetchMock = vi.fn()
    withBaseProfileHistory(fetchMock)
    fetchMock.mockReturnValueOnce(deleteAllPromise)
    global.fetch = fetchMock as unknown as typeof global.fetch

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
