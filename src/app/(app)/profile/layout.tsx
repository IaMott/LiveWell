import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProfileNav } from '@/components/profile/ProfileNav'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UserAvatar } from '@/components/profile/UserAvatar'

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
  const profileImage = session.user?.image ?? null

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

        <UserAvatar
          name={session.user?.name}
          imageUrl={profileImage}
          initialsOverride={initials}
          size={40}
          ariaLabel="Avatar profilo"
        />
      </header>

      {/* Profile header */}
      <div
        style={{
          textAlign: 'center',
          padding: '0.5rem 1rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <UserAvatar
          name={session.user?.name}
          imageUrl={profileImage}
          initialsOverride={initials}
          size={92}
          ariaLabel="Immagine profilo"
        />
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
