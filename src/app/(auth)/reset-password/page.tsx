'use client'

import { useState, type FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Le password non corrispondono.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } }
        setError(data.error?.message ?? 'Link non valido o scaduto.')
        return
      }
      setDone(true)
    } catch {
      setError('Si è verificato un errore. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <p style={{ textAlign: 'center', color: '#FF3B30' }}>
        Link non valido.{' '}
        <Link href="/forgot-password" style={linkStyle}>
          Richiedi un nuovo link
        </Link>
      </p>
    )
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-text-primary, #1C1C1E)',
            marginBottom: '1rem',
          }}
        >
          Password aggiornata con successo.
        </p>
        <Link href="/login" style={{ ...linkStyle, fontSize: '0.9375rem' }}>
          Accedi ora →
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      <input
        type="password"
        placeholder="Nuova password (min. 8 caratteri)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoFocus
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Conferma password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        style={inputStyle}
      />
      {error && <p style={errorStyle}>{error}</p>}
      <button type="submit" disabled={loading} style={buttonStyle(loading)}>
        {loading ? 'Salvataggio…' : 'Imposta nuova password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={cardStyle}>
      <h1 style={titleStyle}>LiveWell</h1>
      <p style={subtitleStyle}>Nuova password</p>
      <Suspense fallback={<p style={{ textAlign: 'center' }}>Caricamento…</p>}>
        <ResetPasswordForm />
      </Suspense>
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
}
