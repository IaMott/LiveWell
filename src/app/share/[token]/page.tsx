'use client'

import { useState, useEffect, use } from 'react'
import { cn } from '@/lib/utils'

interface SharedMessage {
  role: string
  content: string
  createdAt: string
}

interface SharedConversation {
  id: string
  title: string | null
  createdAt: string
  messages: SharedMessage[]
}

export default function SharedConversationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [conversation, setConversation] = useState<SharedConversation | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error('Non trovata')
        return r.json()
      })
      .then((d) => setConversation(d.conversation))
      .catch(() => setError('Conversazione non trovata o link non valido.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="animate-pulse text-on-surface-muted">Caricamento...</div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-lg font-semibold text-on-surface">Link non valido</p>
          <p className="mt-1 text-sm text-on-surface-muted">{error}</p>
        </div>
      </div>
    )
  }

  const date = new Date(conversation.createdAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      {/* Header */}
      <header className="border-b border-surface-dim px-4 py-4 print:border-black">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-brand-500 font-medium">LiveWell</p>
          <h1 className="mt-1 text-xl font-semibold text-on-surface">
            {conversation.title || 'Conversazione condivisa'}
          </h1>
          <p className="mt-0.5 text-xs text-on-surface-muted">{date}</p>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-4">
          {conversation.messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const time = new Date(msg.createdAt).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={i}
                className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5',
                    isUser
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-dim text-on-surface',
                    'print:border print:border-gray-300 print:bg-white print:text-black',
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  <p
                    className={cn(
                      'mt-1 text-right text-[10px]',
                      isUser ? 'text-white/70' : 'text-on-surface-muted',
                      'print:text-gray-500',
                    )}
                  >
                    {time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-dim px-4 py-4 text-center print:border-black">
        <p className="text-xs text-on-surface-muted">
          Conversazione condivisa da LiveWell &mdash; Il tuo assistente benessere
        </p>
        {/* Print button - hidden in print */}
        <button
          onClick={() => window.print()}
          className="mt-3 rounded-full bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 print:hidden"
        >
          Stampa / Salva PDF
        </button>
      </footer>
    </div>
  )
}
