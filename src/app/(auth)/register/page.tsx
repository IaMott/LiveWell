'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } }
        setError(data.error?.message ?? 'Registrazione fallita.')
        return
      }
      window.location.href = '/login'
    } catch {
      setError('Si è verificato un errore. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '360px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '1.25rem',
        padding: '2rem',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}
    >
      <h1
        style={{
          textAlign: 'center',
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '0.25rem',
          color: 'var(--color-text-primary)',
        }}
      >
        LiveWell
      </h1>
      <p
        style={{
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
          marginBottom: '1.5rem',
        }}
      >
        Crea il tuo profilo
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          type="text"
          placeholder="Nome (opzionale)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-separator)',
            fontSize: '1rem',
            outline: 'none',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-separator)',
            fontSize: '1rem',
            outline: 'none',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
        <input
          type="password"
          placeholder="Password (min. 8 caratteri)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-separator)',
            fontSize: '1rem',
            outline: 'none',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
          }}
        />

        {error && (
          <p style={{ fontSize: '0.875rem', color: '#FF3B30', textAlign: 'center' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.875rem',
            borderRadius: '0.75rem',
            backgroundColor: 'var(--color-text-primary)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            marginTop: '0.25rem',
          }}
        >
          {loading ? 'Registrazione...' : 'Crea account'}
        </button>
      </form>

      <p
        style={{
          textAlign: 'center',
          marginTop: '1.25rem',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        Hai già un account?{' '}
        <Link
          href="/login"
          style={{ color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'none' }}
        >
          Accedi
        </Link>
      </p>
    </div>
  )
}
