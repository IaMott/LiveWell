'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications'

interface TopBarProps {
  className?: string
  /** User initials shown in the avatar circle (chat mode only). Default: generic icon */
  userInitials?: string
}

export function TopBar({ className, userInitials }: TopBarProps) {
  const pathname = usePathname()
  const isProfile = pathname?.startsWith('/profile')

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
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-brand-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/design/icons/live.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden="true"
              style={{ display: 'inline-block' }}
            />
            LiveWell
          </span>
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
              'text-sm font-semibold',
            )}
            aria-label="Profilo utente"
          >
            {userInitials ? (
              <span>{userInitials.slice(0, 2).toUpperCase()}</span>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            )}
          </Link>
        )}
      </div>

      {isProfile && (
        <span className="text-lg font-semibold tracking-tight text-brand-600">Profilo</span>
      )}
    </header>
  )
}
