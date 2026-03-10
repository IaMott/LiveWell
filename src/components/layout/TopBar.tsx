'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ArrowLeft, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  className?: string
  userInitials?: string
}

export function TopBar({ className, userInitials = 'MM' }: TopBarProps) {
  const pathname = usePathname()

  // ── Settings page ───────────────────────────────────────────────────────────
  if (pathname?.startsWith('/profile/settings')) {
    return (
      <header className={cn('relative z-20 flex h-14 shrink-0 items-center justify-between px-4', className)}>
        <Link href="/profile" className="flex h-9 w-9 items-center justify-center text-on-surface-muted hover:text-on-surface">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-base font-semibold text-on-surface">Impostazioni</span>
        <Link
          href="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          aria-label="Profilo"
        >
          {userInitials.slice(0, 2).toUpperCase()}
        </Link>
      </header>
    )
  }

  // ── Profile pages ───────────────────────────────────────────────────────────
  if (pathname?.startsWith('/profile')) {
    return (
      <header className={cn('relative z-20 flex h-14 shrink-0 items-center justify-between px-4', className)}>
        <Link href="/" className="flex h-9 w-9 items-center justify-center text-on-surface-muted hover:text-on-surface">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-base font-semibold text-on-surface">Profilo</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Esci
        </button>
      </header>
    )
  }

  // ── Chat page (default) ─────────────────────────────────────────────────────
  return (
    <header className={cn('relative z-20 flex h-14 shrink-0 items-center justify-between px-4', className)}>
      {/* Settings gear — links to settings */}
      <Link
        href="/profile/settings"
        className="flex h-9 w-9 items-center justify-center text-on-surface-muted transition-colors hover:text-on-surface"
        aria-label="Impostazioni"
      >
        <Settings className="h-5 w-5" />
      </Link>

      {/* User avatar — links to profile */}
      <Link
        href="/profile"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          'bg-brand-100 text-brand-700 text-sm font-semibold transition-colors',
          'hover:bg-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        )}
        aria-label="Profilo utente"
      >
        {userInitials.slice(0, 2).toUpperCase()}
      </Link>
    </header>
  )
}
