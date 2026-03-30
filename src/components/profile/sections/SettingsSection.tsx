'use client'

import { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type React from 'react'

type Props = { user: { email: string; name?: string | null } }

const ACCENT_COLORS = [
  '#007AFF',
  '#34C759',
  '#FF3B30',
  '#FF9F0A',
  '#AF52DE',
  '#5AC8FA',
  '#FF2D55',
  '#FFCC00',
]

function dispatchSettingsChanged() {
  window.dispatchEvent(new Event('lw-settings-changed'))
}

function getSavedSettings(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Persist to localStorage AND dispatch change event (visual-only, no SSR). */
function saveLocal(updates: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    const current = JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<
      string,
      unknown
    >
    localStorage.setItem('lw_settings', JSON.stringify({ ...current, ...updates }))
    dispatchSettingsChanged()
  } catch {}
}

/** Debounced PATCH to /api/user/preferences — persists to DB for cross-device sync. */
function usePrefsSyncer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (updates: Record<string, unknown>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(() => {
        // Best-effort; localStorage is the immediate fallback
      })
    }, 600)
  }
}

export function SettingsSection({ user }: Props) {
  const router = useRouter()
  const syncPrefs = usePrefsSyncer()

  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  // ── Appearance ─────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const s = getSavedSettings()
    return (s.theme as 'light' | 'dark' | 'system') ?? 'system'
  })
  const [accentColor, setAccentColor] = useState<string>(() => {
    const s = getSavedSettings()
    return (s.accentColor as string) ?? '#007AFF'
  })
  const [reduceAnim, setReduceAnim] = useState<boolean>(() => {
    const s = getSavedSettings()
    return s.reduceAnim !== undefined ? (s.reduceAnim as boolean) : false
  })

  // ── Notifications ───────────────────────────────────────────────────────
  const [notifInApp, setNotifInApp] = useState<boolean>(() => {
    const s = getSavedSettings()
    return s.notifInApp !== undefined ? (s.notifInApp as boolean) : true
  })

  // ── Geolocation ─────────────────────────────────────────────────────────
  const [geoEnabled, setGeoEnabled] = useState<boolean>(() => {
    const s = getSavedSettings()
    return s.geoEnabled !== undefined ? (s.geoEnabled as boolean) : false
  })
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
  >('idle')

  // ── Hydrate from DB on mount (cross-device sync) ────────────────────────
  useEffect(() => {
    fetch('/api/user/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs: Record<string, unknown> | null) => {
        if (!prefs) return
        if (prefs.theme) {
          setTheme(prefs.theme as 'light' | 'dark' | 'system')
          saveLocal({ theme: prefs.theme })
        }
        if (prefs.accentColor) {
          setAccentColor(prefs.accentColor as string)
          saveLocal({ accentColor: prefs.accentColor })
        }
        if (prefs.reduceAnim !== undefined) {
          setReduceAnim(prefs.reduceAnim as boolean)
          saveLocal({ reduceAnim: prefs.reduceAnim })
        }
        if (prefs.notifInApp !== undefined) {
          setNotifInApp(prefs.notifInApp as boolean)
          saveLocal({ notifInApp: prefs.notifInApp })
        }
        dispatchSettingsChanged()
      })
      .catch(() => {})
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleTheme(t: 'light' | 'dark' | 'system') {
    setTheme(t)
    saveLocal({ theme: t })
    syncPrefs({ theme: t })
  }

  function handleAccent(c: string) {
    setAccentColor(c)
    saveLocal({ accentColor: c })
    syncPrefs({ accentColor: c })
  }

  function handleReduceAnim(v: boolean) {
    setReduceAnim(v)
    saveLocal({ reduceAnim: v })
    syncPrefs({ reduceAnim: v })
  }

  function handleNotifInApp(v: boolean) {
    setNotifInApp(v)
    saveLocal({ notifInApp: v })
    syncPrefs({ notifInApp: v })
  }

  // C FIX: request actual browser geolocation when the user enables the toggle
  async function handleGeoToggle(v: boolean) {
    setGeoEnabled(v)
    saveLocal({ geoEnabled: v })

    if (v) {
      if (!('geolocation' in navigator)) {
        setGeoStatus('unavailable')
        // Still save preference to DB (IP-based fallback will be used)
        void fetch('/api/geo/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        }).catch(() => {
          setGeoEnabled(false)
          saveLocal({ geoEnabled: false })
        })
        return
      }

      setGeoStatus('requesting')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Precise GPS coordinates — backend rounds to ~1km before storage
          setGeoStatus('granted')
          void fetch('/api/geo/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: true,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              accuracy: 'browser-gps',
            }),
          }).catch(() => {
            setGeoEnabled(false)
            saveLocal({ geoEnabled: false })
            setGeoStatus('idle')
          })
        },
        () => {
          // Permission denied — fall back to IP-based location (coarse)
          setGeoStatus('denied')
          void fetch('/api/geo/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true }),
          }).catch(() => {
            setGeoEnabled(false)
            saveLocal({ geoEnabled: false })
            setGeoStatus('idle')
          })
        },
        { timeout: 8000, maximumAge: 5 * 60 * 1000 },
      )
    } else {
      setGeoStatus('idle')
      void fetch('/api/geo/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }).catch(() => {
        setGeoEnabled(true)
        saveLocal({ geoEnabled: true })
      })
    }
  }

  async function handleResetMemory() {
    const confirmed = window.confirm(
      'Sei sicuro? Questa azione elimina tutta la cronologia delle conversazioni e i dati raccolti dal team. Non è reversibile.',
    )
    if (!confirmed) return
    setResetLoading(true)
    setResetMessage(null)
    try {
      const res = await fetch('/api/user/reset-data', { method: 'DELETE' })
      if (res.ok) {
        setResetMessage('Memoria azzerata. Puoi iniziare da capo.')
        router.refresh()
      } else {
        setResetMessage('Errore durante il reset. Riprova.')
      }
    } catch {
      setResetMessage('Errore di rete. Riprova.')
    } finally {
      setResetLoading(false)
    }
  }

  const geoHintText =
    geoStatus === 'requesting'
      ? 'Richiesta permesso posizione in corso…'
      : geoStatus === 'granted'
        ? '✓ Posizione GPS acquisita (arrotondata a ~1 km per la privacy)'
        : geoStatus === 'denied'
          ? 'Permesso negato — useremo la posizione approssimativa tramite IP'
          : geoStatus === 'unavailable'
            ? 'Geolocalizzazione non disponibile su questo dispositivo'
            : 'Abilitazione della posizione per usare normative, alimenti e dati sanitari nazionali.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Account */}
      <section>
        <SectionLabel>Account</SectionLabel>
        <Card>
          <RowItem label="Email" value={user.email} />
          <Divider />
          <RowItem label="Piano" value="Free" />
        </Card>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            ...actionButtonStyle,
            color: '#FF3B30',
            borderColor: '#FF3B30',
            marginTop: '0.5rem',
          }}
        >
          Disconnetti
        </button>
      </section>

      {/* Aspetto */}
      <section>
        <SectionLabel>Aspetto</SectionLabel>
        <Card>
          <div
            style={{
              paddingBottom: '1rem',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--color-separator, #E5E5EA)',
            }}
          >
            <span style={rowLabelStyle}>Tema</span>
            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTheme(t)}
                  style={{
                    padding: '0.375rem 0.875rem',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: theme === t ? 600 : 400,
                    cursor: 'pointer',
                    backgroundColor:
                      theme === t
                        ? 'var(--color-text-primary, #1C1C1E)'
                        : 'var(--color-bg, #F2F2F7)',
                    color: theme === t ? '#fff' : 'var(--color-text-secondary, #8E8E93)',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'light' ? 'Chiaro' : t === 'dark' ? 'Scuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              paddingBottom: '1rem',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--color-separator, #E5E5EA)',
            }}
          >
            <span style={rowLabelStyle}>Tint principale</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleAccent(c)}
                  style={{
                    width: '1.875rem',
                    height: '1.875rem',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border:
                      accentColor === c
                        ? '3px solid var(--color-text-primary, #1C1C1E)'
                        : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>
          </div>

          <ToggleRow label="Riduci animazioni" value={reduceAnim} onChange={handleReduceAnim} />
        </Card>
      </section>

      {/* Notifiche */}
      <section>
        <SectionLabel>Notifiche</SectionLabel>
        <Card>
          <ToggleRow label="Notifiche in-app" value={notifInApp} onChange={handleNotifInApp} />
          <Divider />
          {/* Push web: not yet implemented — shown as disabled with tooltip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary, #8E8E93)',
                opacity: 0.5,
              }}
            >
              Push web{' '}
              <span
                style={{
                  fontSize: '0.7rem',
                  background: 'var(--color-separator, #E5E5EA)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                }}
              >
                In arrivo
              </span>
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary, #8E8E93)',
                opacity: 0.4,
              }}
            >
              —
            </span>
          </div>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              margin: '0.625rem 0 0',
              lineHeight: 1.4,
            }}
          >
            Le notifiche in-app sono inviate solo per messaggi importanti dei professionisti.
          </p>
        </Card>
      </section>

      {/* Geolocalizzazione */}
      <section>
        <SectionLabel>Geolocalizzazione</SectionLabel>
        <Card>
          <ToggleRow
            label="Abilita la rilevazione"
            value={geoEnabled}
            onChange={(v) => void handleGeoToggle(v)}
          />
          <p
            style={{
              fontSize: '0.75rem',
              color:
                geoStatus === 'granted'
                  ? '#34C759'
                  : geoStatus === 'denied'
                    ? '#FF9F0A'
                    : 'var(--color-text-secondary, #8E8E93)',
              margin: '0.625rem 0 0',
              lineHeight: 1.4,
              transition: 'color 0.2s',
            }}
          >
            {geoHintText}
          </p>
        </Card>
      </section>

      {/* Dati e Privacy */}
      <section>
        <SectionLabel>Dati e Privacy</SectionLabel>
        <Card>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              margin: '0 0 0.875rem 0',
              lineHeight: 1.5,
            }}
          >
            Azzera la memoria del team AI: elimina tutte le conversazioni, i dati raccolti dagli
            specialisti e lo storico clinico. Il tuo account rimane attivo.
          </p>
          <button
            type="button"
            onClick={() => void handleResetMemory()}
            disabled={resetLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              border: '1px solid #FF3B30',
              backgroundColor: 'transparent',
              color: '#FF3B30',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: resetLoading ? 'not-allowed' : 'pointer',
              opacity: resetLoading ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {resetLoading ? 'Azzeramento in corso…' : 'Azzera memoria AI'}
          </button>
          {resetMessage && (
            <p
              style={{
                fontSize: '0.75rem',
                color: resetMessage.startsWith('Memoria') ? '#34C759' : '#FF3B30',
                margin: '0.5rem 0 0',
                textAlign: 'center',
              }}
            >
              {resetMessage}
            </p>
          )}
        </Card>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--color-text-secondary, #8E8E93)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: '0 0 0.5rem 0.25rem',
      }}
    >
      {children}
    </h2>
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface, #fff)',
        borderRadius: '1rem',
        padding: '0.875rem 1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {children}
    </div>
  )
}
function RowItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-text-primary, #1C1C1E)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
function Divider() {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: 'var(--color-separator, #E5E5EA)',
        margin: '0.75rem 0',
      }}
    />
  )
}
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary, #1C1C1E)' }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: '2.875rem',
          height: '1.625rem',
          borderRadius: '999px',
          border: 'none',
          backgroundColor: value ? '#34C759' : 'var(--color-separator, #E5E5EA)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          transition: 'background-color 0.2s',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: value ? 'calc(100% - 22px)' : '2px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  )
}
const rowLabelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
const actionButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem',
  borderRadius: '1rem',
  border: '1px solid',
  backgroundColor: 'transparent',
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
}
