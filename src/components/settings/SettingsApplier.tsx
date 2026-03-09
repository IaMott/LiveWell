'use client'

import { useEffect } from 'react'

/**
 * Reads lw_settings from localStorage and applies:
 * - data-theme attribute on <html> for dark/light/system
 * - --color-accent CSS variable on :root for tint color
 * Runs on every mount (client-side only).
 */
export function SettingsApplier() {
  useEffect(() => {
    function apply() {
      try {
        const saved = JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<string, unknown>

        // Theme
        const theme = (saved.theme as string) ?? 'system'
        document.documentElement.setAttribute('data-theme', theme)

        // Accent color
        const accent = (saved.accentColor as string) ?? '#007AFF'
        document.documentElement.style.setProperty('--color-accent', accent)
      } catch {}
    }

    apply()

    // Also re-apply when storage changes (other tab or same tab via settings page)
    window.addEventListener('storage', apply)
    // Custom event dispatched by SettingsSection after save
    window.addEventListener('lw-settings-changed', apply)
    return () => {
      window.removeEventListener('storage', apply)
      window.removeEventListener('lw-settings-changed', apply)
    }
  }, [])

  return null
}
