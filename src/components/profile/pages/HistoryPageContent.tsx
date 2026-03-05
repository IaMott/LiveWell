'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MessageSquare, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: string
  messages: { content: string; role: string }[]
}

type ProfileHistorySection =
  | 'all'
  | 'health'
  | 'nutrition'
  | 'training'
  | 'mindfulness'
  | 'goals'

interface ProfileHistoryEntry {
  id: string
  section: Exclude<ProfileHistorySection, 'all'>
  timestamp: string
  domain: string
  primarySpecialist: string
  contributors: string[]
  userMessage: string
  assistantSummary: string
  attachments: { fileName?: string; type?: string }[]
}

interface ProfileHistoryResponse {
  timeline: ProfileHistoryEntry[]
  attachmentsBySection: Partial<
    Record<Exclude<ProfileHistorySection, 'all'>, { fileName?: string; type?: string }[]>
  >
}

const SECTION_OPTIONS: Array<{ key: ProfileHistorySection; label: string }> = [
  { key: 'all', label: 'Tutte' },
  { key: 'health', label: 'Salute' },
  { key: 'nutrition', label: 'Nutrizione' },
  { key: 'training', label: 'Allenamento' },
  { key: 'mindfulness', label: 'Mindfulness' },
  { key: 'goals', label: 'Obiettivi' },
]

function getSectionLabel(section: ProfileHistoryEntry['section']): string {
  return SECTION_OPTIONS.find((opt) => opt.key === section)?.label ?? section
}

function getSpecialistLabel(specialist: string): string {
  return specialist.replaceAll('_', ' ')
}

export function HistoryPageContent() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [timeline, setTimeline] = useState<ProfileHistoryEntry[]>([])
  const [attachmentsBySection, setAttachmentsBySection] = useState<
    ProfileHistoryResponse['attachmentsBySection']
  >({})
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedSection, setSelectedSection] = useState<ProfileHistorySection>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/conversations')
    if (!response.ok) throw new Error('load conversations failed')
    const data = await response.json()
    setConversations(data.conversations || [])
  }, [])

  const loadProfileHistory = useCallback(async (section: ProfileHistorySection) => {
    setHistoryLoading(true)
    try {
      const query = section === 'all' ? '' : `?section=${section}`
      const response = await fetch(`/api/profile/history${query}`)
      if (!response.ok) throw new Error('load history failed')
      const data = (await response.json()) as ProfileHistoryResponse
      setTimeline(data.timeline || [])
      setAttachmentsBySection(data.attachmentsBySection || {})
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadConversations(), loadProfileHistory('all')])
      .catch(() => setError('Errore nel caricamento dello storico'))
      .finally(() => setLoading(false))
  }, [loadConversations, loadProfileHistory])

  async function handleSectionChange(section: ProfileHistorySection) {
    if (historyLoading) return
    setSelectedSection(section)
    setError('')
    try {
      await loadProfileHistory(section)
    } catch {
      setError('Errore nel caricamento dello storico profilo')
    }
  }

  async function handleDeleteAll() {
    if (isDeleting || deletingId) return
    const confirmed = window.confirm(
      'Vuoi eliminare tutto lo storico delle conversazioni? Questa azione non puo essere annullata.',
    )
    if (!confirmed) return
    setIsDeleting(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/conversations', { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setConversations([])
      window.localStorage.removeItem('livewell_conversation_id')
      setSuccess('Storico conversazioni eliminato')
    } catch {
      setError('Impossibile eliminare lo storico conversazioni. Riprova.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleDeleteOne(conversationId: string) {
    if (isDeleting || deletingId) return
    const confirmed = window.confirm(
      'Vuoi eliminare questa conversazione? Questa azione non puo essere annullata.',
    )
    if (!confirmed) return
    setDeletingId(conversationId)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      const activeConversationId = window.localStorage.getItem('livewell_conversation_id')
      if (activeConversationId === conversationId) {
        window.localStorage.removeItem('livewell_conversation_id')
      }
      setSuccess('Conversazione eliminata')
    } catch {
      setError('Impossibile eliminare la conversazione. Riprova.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-semibold text-on-surface">Storico</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-xl font-semibold text-on-surface">Storico</h2>
      <p className="text-sm text-on-surface-muted">
        Conversazioni passate e cronologia degli aggiornamenti profilo.
      </p>
      {error && (
        <div className="rounded-[var(--radius-card)] bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[var(--radius-card)] bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {success}
        </div>
      )}

      {conversations.length > 0 && (
        <button
          type="button"
          onClick={handleDeleteAll}
          disabled={isDeleting || deletingId !== null}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300/40 bg-rose-50/40 px-3 text-sm text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Eliminazione storico...' : 'Elimina tutto lo storico'}
        </button>
      )}

      <div className="space-y-3 rounded-[var(--radius-card)] border border-surface-dim p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-on-surface">Storico profilo per sezione</h3>
          <div className="flex flex-wrap gap-2">
            {SECTION_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleSectionChange(option.key)}
                disabled={historyLoading}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-colors',
                  selectedSection === option.key
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-dim text-on-surface-muted hover:bg-surface-dim/80',
                  historyLoading && 'cursor-not-allowed opacity-60',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {historyLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-[var(--radius-card)] bg-surface-dim" />
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-on-surface-muted">Nessun aggiornamento profilo disponibile.</p>
        ) : (
          <div className="space-y-2">
            {timeline.map((entry) => {
              const date = new Date(entry.timestamp).toLocaleString('it-IT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <div key={entry.id} className="rounded-[var(--radius-card)] border border-surface-dim p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-brand-600">
                      {getSectionLabel(entry.section)}
                    </span>
                    <span className="text-xs text-on-surface-muted">{date}</span>
                  </div>
                  <p className="text-xs text-on-surface-muted">
                    Specialista: {getSpecialistLabel(entry.primarySpecialist)}
                  </p>
                  {entry.assistantSummary && (
                    <p className="mt-1 text-sm text-on-surface">{entry.assistantSummary}</p>
                  )}
                  {entry.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.attachments.map((att, idx) => (
                        <span
                          key={`${entry.id}-att-${idx}`}
                          className="rounded-full bg-surface-dim px-2 py-0.5 text-xs text-on-surface-muted"
                        >
                          {att.fileName || `${att.type || 'file'} allegato`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {selectedSection !== 'all' &&
          (attachmentsBySection[selectedSection as Exclude<ProfileHistorySection, 'all'>]
            ?.length ?? 0) > 0 && (
            <p className="text-xs text-on-surface-muted">
              Allegati mappati alla sezione: {' '}
              {attachmentsBySection[selectedSection as Exclude<ProfileHistorySection, 'all'>]
                ?.length ?? 0}
            </p>
          )}
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-surface-dim bg-surface-dim/50 p-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-on-surface-muted" />
          <p className="text-sm text-on-surface-muted">Nessuna conversazione ancora.</p>
          <Link href="/" className="mt-2 inline-block text-sm font-medium text-brand-500 hover:text-brand-600">
            Inizia una conversazione
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[0]
            const preview = lastMsg?.content.slice(0, 80) || 'Nessun messaggio'
            const date = new Date(conv.updatedAt).toLocaleDateString('it-IT', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={conv.id}
                className={cn(
                  'rounded-[var(--radius-card)] border border-surface-dim p-4',
                  'transition-colors hover:bg-surface-dim/50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/?c=${conv.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {conv.title || 'Conversazione senza titolo'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-muted">{preview}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-on-surface-muted">{date}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteOne(conv.id)}
                      disabled={isDeleting || deletingId !== null}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-300/40 bg-rose-50/40 text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Elimina conversazione"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
