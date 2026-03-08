'use client'

import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { signOut } from 'next-auth/react'

type Props = { data: ProfileData }

export function SettingsSection({ data }: Props) {
  const { user, profile } = data
  const settings = profile?.settings as Record<string, unknown> | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Account info */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '1rem',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--color-separator)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Nome</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {user.name ?? '—'}
          </span>
        </div>
        <div
          style={{
            padding: '0.875rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Email</span>
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              wordBreak: 'break-all',
            }}
          >
            {user.email}
          </span>
        </div>
      </div>

      {/* Preferences */}
      {settings && Object.keys(settings).length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 0.75rem',
            }}
          >
            Preferenze
          </h2>
          {Object.entries(settings)
            .slice(0, 4)
            .map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: '0.5rem',
                  marginBottom: '0.5rem',
                  borderBottom: '1px solid var(--color-separator)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {key.replace(/_/g, ' ')}
                </span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {String(val)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Logout */}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        style={{
          width: '100%',
          padding: '0.875rem',
          borderRadius: '1rem',
          border: '1px solid #FF3B30',
          backgroundColor: 'transparent',
          color: '#FF3B30',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Esci dall&apos;account
      </button>
    </div>
  )
}
