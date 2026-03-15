'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

type NotificationsResponse = {
  notifications: Notification[]
  unreadCount: number
}

const POLL_INTERVAL_MS = 30_000 // refresh every 30s

function IconBell({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: hasUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
    >
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = (await res.json()) as NotificationsResponse
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // best-effort
    }
  }, [])

  useEffect(() => {
    // Initial load + polling: fetchNotifications updates component state from external API
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNotifications()
    const handle = setInterval(() => void fetchNotifications(), POLL_INTERVAL_MS)
    return () => clearInterval(handle)
  }, [fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside)
    }
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // best-effort
    }
  }

  function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) {
      void markAllRead()
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 1) return 'Adesso'
    if (diffMin < 60) return `${diffMin}m fa`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h fa`
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        type="button"
        aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`}
        onClick={handleOpen}
        style={{
          width: '2.25rem',
          height: '2.25rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          color: 'var(--color-text-primary)',
        }}
      >
        <IconBell hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              minWidth: '14px',
              height: '14px',
              borderRadius: '7px',
              backgroundColor: '#FF3B30',
              color: '#fff',
              fontSize: '0.5625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '20rem',
            maxHeight: '22rem',
            overflowY: 'auto',
            backgroundColor: 'var(--color-background)',
            borderRadius: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid var(--color-separator)',
            zIndex: 200,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem 0.5rem',
              borderBottom: '1px solid var(--color-separator)',
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Notifiche
            </span>
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              Nessuna notifica
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.125rem',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--color-separator)',
                    backgroundColor: n.read ? 'transparent' : 'rgba(0,122,255,0.04)',
                  }}
                >
                  {!n.read && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#007AFF',
                        display: 'inline-block',
                        marginBottom: '2px',
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {n.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {n.message}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-secondary)',
                      opacity: 0.6,
                      marginTop: '2px',
                    }}
                  >
                    {formatTime(n.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
