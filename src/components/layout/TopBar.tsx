'use client'

import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  className?: string
  onAvatarClick?: () => void
}

export function TopBar({ className, onAvatarClick }: TopBarProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-surface-dim px-4',
        'bg-surface/80 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tracking-tight text-brand-600">LiveWell</span>
      </div>

      <button
        type="button"
        onClick={onAvatarClick}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          'bg-brand-100 text-brand-700 transition-colors',
          'hover:bg-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        )}
        aria-label="Profilo utente"
      >
        <User className="h-5 w-5" />
      </button>
    </header>
  )
}
