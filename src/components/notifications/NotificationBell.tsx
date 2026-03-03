'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationCenter } from './NotificationCenter'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, markAllRead, dismiss } = useNotifications()

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full',
          'text-on-surface-muted transition-colors hover:text-on-surface',
        )}
        aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationCenter
          notifications={notifications}
          onMarkRead={markAsRead}
          onMarkAllRead={markAllRead}
          onDismiss={dismiss}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
