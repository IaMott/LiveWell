'use client'

import { useEffect } from 'react'

/**
 * Applies visual settings (theme, accent color, reduce-animations) from:
 * 1. localStorage immediately on mount (fast, no flicker)
 * 2. /api/user/preferences on hydration (cross-device sync)
 *
 * Listens for storage and custom lw-settings-changed events to stay in sync
 * when settings change in another tab or in the settings page.
 */
export function SettingsApplier() {
  useEffect(() => {
    function applyFromStorage() {
      try {
        const saved = JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<
          string,
          unknown
        >

        // Theme
        const theme = (saved.theme as string) ?? 'system'
        document.documentElement.setAttribute('data-theme', theme)

        // Accent color
        const accent = (saved.accentColor as string) ?? '#007AFF'
        document.documentElement.style.setProperty('--color-accent', accent)

        // Reduce animations
        const reduceAnim = saved.reduceAnim === true
        document.documentElement.setAttribute(
          'data-reduce-motion',
          reduceAnim ? 'reduce' : 'no-preference',
        )
      } catch {}
    }

    // 1. Apply immediately from localStorage (zero-latency, avoids flash)
    applyFromStorage()

    // 2. Hydrate from API for cross-device sync
    fetch('/api/user/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs: Record<string, unknown> | null) => {
        if (!prefs) return
        try {
          const current = JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<
            string,
            unknown
          >
          const merged = { ...current, ...prefs }
          localStorage.setItem('lw_settings', JSON.stringify(merged))
          applyFromStorage()
        } catch {}
      })
      .catch(() => {})

    // 3. Re-apply when storage changes (other tab, or settings page dispatch)
    window.addEventListener('storage', applyFromStorage)
    window.addEventListener('lw-settings-changed', applyFromStorage)

    return () => {
      window.removeEventListener('storage', applyFromStorage)
      window.removeEventListener('lw-settings-changed', applyFromStorage)
    }
  }, [])

  return null
}
