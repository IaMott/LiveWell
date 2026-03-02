'use client'

import type { FormEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ProfileFormProps {
  onSubmit: (e: FormEvent) => void
  saving: boolean
  error: string
  success: string
  children: ReactNode
}

export function ProfileForm({ onSubmit, saving, error, success, children }: ProfileFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6 pt-4">
      {error && (
        <div className="rounded-[var(--radius-card)] bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[var(--radius-card)] bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {success}
        </div>
      )}
      {children}
      <button
        type="submit"
        disabled={saving}
        className={cn(
          'w-full rounded-[var(--radius-input)] bg-brand-500 px-4 py-2.5 text-sm font-medium text-white',
          'transition-colors hover:bg-brand-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {saving ? 'Salvataggio...' : 'Salva'}
      </button>
    </form>
  )
}

export const inputClass = cn(
  'w-full rounded-[var(--radius-card)] border border-surface-dim bg-surface px-3 py-2 text-sm text-on-surface',
  'placeholder:text-on-surface-muted',
  'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
)

export const labelClass = 'mb-1 block text-sm font-medium text-on-surface'

export const selectClass = cn(
  'w-full rounded-[var(--radius-card)] border border-surface-dim bg-surface px-3 py-2 text-sm text-on-surface',
  'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
)
