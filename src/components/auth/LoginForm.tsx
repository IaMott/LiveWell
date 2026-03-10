'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function LoginForm() {
  const router = useRouter()
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
        setError('Email o password non validi')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-600">LiveWell</h1>
        <p className="mt-1 text-sm text-on-surface-muted">Accedi al tuo account</p>
      </div>

      {error && (
        <div className="rounded-[var(--radius-card)] bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-on-surface">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              'w-full rounded-[var(--radius-card)] border border-surface-dim bg-surface px-3 py-2 text-sm text-on-surface',
              'placeholder:text-on-surface-muted',
              'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
            )}
            placeholder="nome@esempio.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-on-surface">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              'w-full rounded-[var(--radius-card)] border border-surface-dim bg-surface px-3 py-2 text-sm text-on-surface',
              'placeholder:text-on-surface-muted',
              'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
            )}
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={cn(
          'w-full rounded-[var(--radius-input)] bg-brand-500 px-4 py-2.5 text-sm font-medium text-white',
          'transition-colors hover:bg-brand-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {loading ? 'Accesso in corso...' : 'Accedi'}
      </button>

      <p className="text-center text-sm text-on-surface-muted">
        Non hai un account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Registrati
        </Link>
      </p>
    </form>
  )
}
