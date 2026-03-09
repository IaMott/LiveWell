import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SettingsApplier } from '@/components/settings/SettingsApplier'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-bg)',
        maxWidth: '640px',
        margin: '0 auto',
      }}
    >
      <SettingsApplier />

      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3.5rem 1rem 0.75rem',
        }}
      >
        <Link
          href="/"
          aria-label="Torna alla chat"
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-primary)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </Link>

        <span
          style={{
            fontSize: '1.0625rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          Impostazioni
        </span>

        {/* Right spacer (symmetry) */}
        <div style={{ width: '2.25rem' }} />
      </header>

      <main style={{ flex: 1, padding: '1rem' }}>{children}</main>
    </div>
  )
}
