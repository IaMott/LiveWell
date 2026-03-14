'use client'

/**
 * FeedbackWidget — rating 1-5 stelle per una risposta AI.
 *
 * Uso:
 *   <FeedbackWidget conversationId="..." requestId="..." />
 *
 * Si mostra subito dopo la risposta del assistente.
 * Scompare dopo il voto con un animazione di conferma.
 */

import { useState } from 'react'

type Props = {
  conversationId: string
  requestId: string
  className?: string
}

type State = 'idle' | 'hovering' | 'loading' | 'done' | 'error'

const STAR_LABELS = ['Pessimo', 'Scarso', 'Nella media', 'Buono', 'Ottimo']

export function FeedbackWidget({ conversationId, requestId, className = '' }: Props) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  const [state, setState] = useState<State>('idle')

  async function submitRating(rating: number) {
    if (state === 'loading' || state === 'done') return
    setSelected(rating)
    setState('loading')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, requestId, rating }),
      })
      if (!res.ok) throw new Error('Failed')
      setState('done')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  if (state === 'done') {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
        <span className="text-green-500">✓</span>
        Grazie per il feedback!
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className={`text-xs text-red-400 ${className}`}>Errore nell&apos;invio. Riprova.</div>
    )
  }

  const activeRating = hovered || selected
  const label = activeRating > 0 ? STAR_LABELS[activeRating - 1] : 'Valuta questa risposta'

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="group"
      aria-label="Valuta risposta"
    >
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={state === 'loading'}
            aria-label={`${STAR_LABELS[star - 1]}`}
            className={`text-base transition-transform hover:scale-110 disabled:cursor-not-allowed ${
              star <= activeRating ? 'text-yellow-400' : 'text-gray-300'
            }`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => submitRating(star)}
          >
            ★
          </button>
        ))}
      </div>
      {state === 'loading' && <span className="text-xs text-gray-300 animate-pulse">…</span>}
    </div>
  )
}
