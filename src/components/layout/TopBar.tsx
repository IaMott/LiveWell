import Link from 'next/link'
import { Settings } from 'lucide-react'

type Props = { userInitials?: string }

export function TopBar({ userInitials = 'ME' }: Props) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3.5rem 1rem 0.75rem',
      }}
    >
      <Link
        href="/profile/impostazioni"
        aria-label="Impostazioni"
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
        <Settings size={22} strokeWidth={1.5} />
      </Link>

      <Link
        href="/profile"
        aria-label="Vai al profilo"
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
          letterSpacing: '0.02em',
          textDecoration: 'none',
        }}
      >
        {userInitials}
      </Link>
    </header>
  )
}
