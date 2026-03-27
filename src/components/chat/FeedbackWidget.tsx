'use client'

/**
 * FeedbackWidget — rating 1-5 stelle + commento opzionale per ogni messaggio AI.
 * Strumento di studio: i dati vanno in MessageReview, isolato dal profilo utente.
 */

import { useEffect, useState } from 'react'

type Props = {
  messageId: string
  conversationId: string
  agentId?: string
  agentName?: string
  domain?: string
}

type State = 'idle' | 'comment' | 'loading' | 'done' | 'error'

type PersistedReview = {
  rating: number
  comment?: string | null
}

const STAR_LABELS = ['Pessimo', 'Scarso', 'Nella media', 'Buono', 'Ottimo']

export function FeedbackWidget({ messageId, conversationId, agentId, agentName, domain }: Props) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    let mounted = true

    async function loadExistingReview() {
      try {
        const res = await fetch(`/api/feedback?messageId=${encodeURIComponent(messageId)}`)
        if (!res.ok) return
        const data = (await res.json()) as { review?: PersistedReview | null }
        if (!mounted || !data.review) return
        setSelected(data.review.rating)
        setComment(data.review.comment ?? '')
        setState('done')
      } catch {
        /* best-effort hydration */
      }
    }

    void loadExistingReview()
    return () => {
      mounted = false
    }
  }, [messageId])

  function selectRating(rating: number) {
    if (state === 'loading' || state === 'done') return
    setSelected(rating)
    setState('comment')
  }

  async function sendReview(withComment: boolean) {
    if (state === 'loading' || state === 'done' || selected === 0) return
    setState('loading')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          conversationId,
          agentId,
          agentName,
          domain,
          rating: selected,
          ...(withComment && comment.trim() ? { comment: comment.trim() } : {}),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setState('done')
    } catch {
      setState('error')
      setTimeout(() => setState('comment'), 2000)
    }
  }

  if (state === 'done') {
    const stars = '★'.repeat(selected) + '☆'.repeat(Math.max(0, 5 - selected))
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0.375rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          marginTop: '0.375rem',
          marginLeft: '0.375rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ color: '#34C759' }}>✓</span>
          <span>Grazie per il feedback!</span>
          {selected > 0 && (
            <span
              aria-label={`Valutazione salvata: ${selected} stelle`}
              style={{ color: '#FF9F0A', letterSpacing: '0.04em' }}
            >
              {stars}
            </span>
          )}
        </div>
        {comment.trim().length > 0 && (
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              opacity: 0.85,
            }}
          >
            “{comment.trim()}”
          </p>
        )}
      </div>
    )
  }

  const activeRating = hovered || selected
  const label = activeRating > 0 ? STAR_LABELS[activeRating - 1] : 'Valuta'

  return (
    <div style={{ marginTop: '0.375rem', marginLeft: '0.375rem' }}>
      {/* Stelle */}
      <div
        role="group"
        aria-label="Valuta risposta"
        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
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
              onClick={() => selectRating(star)}
            >
              ★
            </button>
          ))}
        </div>
        {state === 'loading' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', opacity: 0.5 }}>
            …
          </span>
        )}
        {state === 'error' && (
          <span style={{ fontSize: '0.75rem', color: '#FF3B30' }}>Errore. Riprova.</span>
        )}
      </div>

      {/* Campo commento — appare dopo selezione stelle */}
      {(state === 'comment' || state === 'loading') && (
        <div
          style={{
            marginTop: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            maxWidth: '360px',
          }}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={state === 'loading'}
            placeholder="Commento opzionale — cosa ha funzionato o cosa miglioreresti?"
            rows={2}
            maxLength={1000}
            style={{
              width: '100%',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              padding: '0.375rem 0.5rem',
              borderRadius: '8px',
              border: '1px solid var(--color-separator)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => sendReview(true)}
              disabled={state === 'loading'}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: '#007AFF',
                color: '#fff',
                cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                opacity: state === 'loading' ? 0.6 : 1,
              }}
            >
              Invia
            </button>
            <button
              type="button"
              onClick={() => sendReview(false)}
              disabled={state === 'loading'}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--color-separator)',
                background: 'none',
                color: 'var(--color-text-secondary)',
                cursor: state === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              Salta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
