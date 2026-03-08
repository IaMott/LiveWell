import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProfileNav } from '@/components/profile/ProfileNav'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const initials = session.user?.name
    ? session.user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'MM'

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
          Profilo
        </span>

        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            backgroundColor: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
      </header>

      {/* Profile name */}
      <div
        style={{
          textAlign: 'center',
          padding: '0.5rem 1rem 1rem',
        }}
      >
        <p
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            margin: 0,
            color: 'var(--color-text-primary)',
          }}
        >
          {session.user?.name ?? 'Utente'}
        </p>
      </div>

      {/* Domain tabs */}
      <ProfileNav />

      {/* Page content */}
      <main style={{ flex: 1, padding: '1rem' }}>{children}</main>
    </div>
  )
}
