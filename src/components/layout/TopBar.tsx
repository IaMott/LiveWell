'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications'

interface TopBarProps {
  className?: string
}

export function TopBar({ className }: TopBarProps) {
  const pathname = usePathname()
  const isProfile = pathname.startsWith('/profile')

  return (
    <header
      className={cn(
        'relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-surface-dim px-4',
        'bg-surface/80 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {isProfile ? (
          <Link
            href="/"
            className="flex items-center gap-1.5 text-on-surface-muted transition-colors hover:text-on-surface"
            aria-label="Torna alla chat"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Chat</span>
          </Link>
        ) : (
          <span className="text-lg font-semibold tracking-tight text-brand-600">LiveWell</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isProfile && <NotificationBell />}
        {!isProfile && (
          <Link
            href="/profile"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'bg-brand-100 text-brand-700 transition-colors',
              'hover:bg-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            )}
            aria-label="Profilo utente"
          >
            <User className="h-5 w-5" />
          </Link>
        )}
      </div>

      {isProfile && (
        <span className="text-lg font-semibold tracking-tight text-brand-600">Profilo</span>
      )}
    </header>
  )
}
