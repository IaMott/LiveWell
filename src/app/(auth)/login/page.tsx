'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError('Email o password non validi.')
      } else {
        window.location.href = '/'
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <h1 style={titleStyle}>LiveWell</h1>
      <p style={subtitleStyle}>Accedi al tuo profilo</p>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
          <Link href="/forgot-password" style={linkStyle}>
            Password dimenticata?
          </Link>
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <button type="submit" disabled={loading} style={buttonStyle(loading)}>
          {loading ? 'Accesso…' : 'Accedi'}
        </button>
      </form>

      <p style={footerStyle}>
        Non hai un account?{' '}
        <Link href="/register" style={linkStyle}>
          Registrati
        </Link>
      </p>
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
  marginTop: '0.25rem',
})
const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '1.25rem',
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
const linkStyle: React.CSSProperties = {
  color: 'var(--color-accent, #007AFF)',
  fontWeight: 500,
  textDecoration: 'none',
  fontSize: '0.875rem',
}
