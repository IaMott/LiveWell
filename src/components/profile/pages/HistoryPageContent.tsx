'use client'

import { useState, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
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

  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

      {conversations.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-surface-dim bg-surface-dim/50 p-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-on-surface-muted" />
          <p className="text-sm text-on-surface-muted">Nessuna conversazione ancora.</p>
          <a href="/" className="mt-2 inline-block text-sm font-medium text-brand-500 hover:text-brand-600">
            Inizia una conversazione
          </a>
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
              <a
                key={conv.id}
                href={`/?c=${conv.id}`}
                className={cn(
                  'block rounded-[var(--radius-card)] border border-surface-dim p-4',
                  'transition-colors hover:bg-surface-dim/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {conv.title || 'Conversazione senza titolo'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-muted">{preview}</p>
                  </div>
                  <span className="shrink-0 text-xs text-on-surface-muted">{date}</span>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
