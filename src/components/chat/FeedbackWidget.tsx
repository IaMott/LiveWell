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
}

type State = 'idle' | 'loading' | 'done' | 'error'

const STAR_LABELS = ['Pessimo', 'Scarso', 'Nella media', 'Buono', 'Ottimo']

export function FeedbackWidget({ conversationId, requestId }: Props) {
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          marginTop: '0.375rem',
          marginLeft: '0.375rem',
        }}
      >
        <span style={{ color: '#34C759' }}>✓</span>
        Grazie per il feedback!
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div
        style={{
          fontSize: '0.75rem',
          color: '#FF3B30',
          marginTop: '0.375rem',
          marginLeft: '0.375rem',
        }}
      >
        Errore nell&apos;invio. Riprova.
      </div>
    )
  }

  const activeRating = hovered || selected
  const label = activeRating > 0 ? STAR_LABELS[activeRating - 1] : 'Valuta'

  return (
    <div
      role="group"
      aria-label="Valuta risposta"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        marginTop: '0.375rem',
        marginLeft: '0.375rem',
      }}
    >
      <span
        style={{
          fontSize: '0.6875rem',
          color: 'var(--color-text-secondary)',
          opacity: 0.6,
          minWidth: '4.5rem',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={state === 'loading'}
            aria-label={STAR_LABELS[star - 1]}
            style={{
              background: 'none',
              border: 'none',
              cursor: state === 'loading' ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              color: star <= activeRating ? '#FF9F0A' : 'var(--color-separator)',
              padding: '2px',
              transition: 'transform 0.1s ease, color 0.1s ease',
              lineHeight: 1,
            }}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => submitRating(star)}
          >
            ★
          </button>
        ))}
      </div>
      {state === 'loading' && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            opacity: 0.5,
          }}
        >
          …
        </span>
      )}
    </div>
  )
}
