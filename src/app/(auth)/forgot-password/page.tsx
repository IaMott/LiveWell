'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Always show success to avoid email enumeration
      setDone(true)
    } catch {
      setError('Si è verificato un errore. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <h1 style={titleStyle}>LiveWell</h1>
      <p style={subtitleStyle}>Recupero password</p>

      {done ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-primary, #1C1C1E)', marginBottom: '1rem' }}>
            Se l&apos;email è registrata riceverai le istruzioni entro pochi minuti.
            Controlla anche la cartella spam.
          </p>
          <Link href="/login" style={{ ...linkStyle, fontSize: '0.9375rem' }}>
            ← Torna al login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #8E8E93)', marginBottom: '0.25rem' }}>
            Inserisci l&apos;email del tuo account e ti invieremo un link per reimpostare la password.
          </p>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" disabled={loading} style={buttonStyle(loading)}>
            {loading ? 'Invio in corso…' : 'Invia link di recupero'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <Link href="/login" style={linkStyle}>
              ← Torna al login
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '360px',
  backgroundColor: 'var(--color-surface, #fff)',
  borderRadius: '1.25rem',
  padding: '2rem',
  boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
}
const titleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '1.5rem',
  fontWeight: 700,
  marginBottom: '0.25rem',
  color: 'var(--color-text-primary, #1C1C1E)',
}
const subtitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
  marginBottom: '1.5rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid var(--color-separator, #E5E5EA)',
  fontSize: '1rem',
  outline: 'none',
  backgroundColor: 'var(--color-bg, #F2F2F7)',
  color: 'var(--color-text-primary, #1C1C1E)',
  boxSizing: 'border-box',
}
const errorStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#FF3B30',
  textAlign: 'center',
}
const buttonStyle = (loading: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.875rem',
  borderRadius: '0.75rem',
  backgroundColor: 'var(--color-text-primary, #1C1C1E)',
  color: '#fff',
  fontSize: '1rem',
  fontWeight: 600,
  border: 'none',
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.6 : 1,
})
const linkStyle: React.CSSProperties = {
  color: 'var(--color-accent, #007AFF)',
  fontWeight: 500,
  textDecoration: 'none',
  fontSize: '0.875rem',
}
