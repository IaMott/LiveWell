'use client'

import { Bell, X, Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/hooks/useNotifications'

const TYPE_ICONS: Record<string, string> = {
  specialist: '🩺',
  reminder: '⏰',
  milestone: '🎯',
  system: '💡',
}

interface NotificationCenterProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
  onClose: () => void
}

export function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClose,
}: NotificationCenterProps) {
  const unread = notifications.filter((n) => !n.read)

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-surface-dim bg-surface shadow-lg">
      <div className="flex items-center justify-between border-b border-surface-dim px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-on-surface">Notifiche</span>
          {unread.length > 0 && (
            <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-xs text-white">
              {unread.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="rounded p-1 text-on-surface-muted transition-colors hover:text-brand-500"
              aria-label="Segna tutte come lette"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-on-surface-muted transition-colors hover:text-on-surface"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-on-surface-muted">
            Nessuna notifica
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                'flex gap-3 border-b border-surface-dim px-4 py-3 last:border-0',
                !notif.read && 'bg-brand-50 dark:bg-brand-950/20',
              )}
            >
              <span className="mt-0.5 text-base">{TYPE_ICONS[notif.type] || '📌'}</span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', !notif.read ? 'font-semibold text-on-surface' : 'text-on-surface')}>
                  {notif.title}
                </p>
                <p className="mt-0.5 text-xs text-on-surface-muted">{notif.message}</p>
                <p className="mt-1 text-xs text-on-surface-muted">
                  {new Date(notif.createdAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {!notif.read && (
                  <button
                    onClick={() => onMarkRead(notif.id)}
                    className="rounded p-1 text-on-surface-muted transition-colors hover:text-brand-500"
                    aria-label="Segna come letta"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDismiss(notif.id)}
                  className="rounded p-1 text-on-surface-muted transition-colors hover:text-red-500"
                  aria-label="Elimina"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
