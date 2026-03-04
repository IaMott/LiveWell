'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: string
  messages: { content: string; role: string }[]
}

export function HistoryPageContent() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleDeleteAll() {
    if (deletingId) return
    const confirmed = window.confirm(
      'Vuoi eliminare tutto lo storico delle conversazioni? Questa azione non puo essere annullata.',
    )
    if (!confirmed) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/conversations', { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setConversations([])
      window.localStorage.removeItem('livewell_conversation_id')
    } catch {
      window.alert('Impossibile eliminare lo storico. Riprova.')
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
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      const activeConversationId = window.localStorage.getItem('livewell_conversation_id')
      if (activeConversationId === conversationId) {
        window.localStorage.removeItem('livewell_conversation_id')
      }
    } catch {
      window.alert('Impossibile eliminare la conversazione. Riprova.')
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
        Le tue conversazioni precedenti con gli specialisti LiveWell.
      </p>
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
