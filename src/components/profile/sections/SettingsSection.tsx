'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const ACCENT_COLORS = ['#007AFF', '#34C759', '#FF3B30', '#FF9F0A', '#AF52DE', '#5AC8FA', '#FF2D55', '#FFCC00']

export function SettingsSection({ data }: Props) {
  const { user } = data
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [accentColor, setAccentColor] = useState('#007AFF')
  const [notifInApp, setNotifInApp] = useState(true)
  const [notifPush, setNotifPush] = useState(false)
  const [geoEnabled, setGeoEnabled] = useState(false)
  const [reduceAnim, setReduceAnim] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<string, unknown>
      if (saved.theme) setTheme(saved.theme as typeof theme)
      if (saved.accentColor) setAccentColor(saved.accentColor as string)
      if (saved.notifInApp !== undefined) setNotifInApp(saved.notifInApp as boolean)
      if (saved.notifPush !== undefined) setNotifPush(saved.notifPush as boolean)
      if (saved.geoEnabled !== undefined) setGeoEnabled(saved.geoEnabled as boolean)
      if (saved.reduceAnim !== undefined) setReduceAnim(saved.reduceAnim as boolean)
    } catch {}
  }, [])

  function save(updates: Record<string, unknown>) {
    try {
      const current = JSON.parse(localStorage.getItem('lw_settings') ?? '{}') as Record<string, unknown>
      localStorage.setItem('lw_settings', JSON.stringify({ ...current, ...updates }))
    } catch {}
  }

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
          style={{ ...actionButtonStyle, color: '#FF3B30', borderColor: '#FF3B30', marginTop: '0.5rem' }}
        >
          Disconnetti
        </button>
      </section>

      {/* Aspetto */}
      <section>
        <SectionLabel>Aspetto</SectionLabel>
        <Card>
          <div style={{ paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-separator, #E5E5EA)' }}>
            <span style={rowLabelStyle}>Tema</span>
            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTheme(t); save({ theme: t }) }}
                  style={{
                    padding: '0.375rem 0.875rem',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: theme === t ? 600 : 400,
                    cursor: 'pointer',
                    backgroundColor: theme === t ? 'var(--color-text-primary, #1C1C1E)' : 'var(--color-bg, #F2F2F7)',
                    color: theme === t ? '#fff' : 'var(--color-text-secondary, #8E8E93)',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'light' ? 'Chiaro' : t === 'dark' ? 'Scuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-separator, #E5E5EA)' }}>
            <span style={rowLabelStyle}>Tint principale</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setAccentColor(c); save({ accentColor: c }) }}
                  style={{
                    width: '1.875rem',
                    height: '1.875rem',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: accentColor === c ? '3px solid var(--color-text-primary, #1C1C1E)' : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>
          </div>

          <ToggleRow
            label="Riduci animazioni"
            value={reduceAnim}
            onChange={(v) => { setReduceAnim(v); save({ reduceAnim: v }) }}
          />
        </Card>
      </section>

      {/* Notifiche */}
      <section>
        <SectionLabel>Notifiche</SectionLabel>
        <Card>
          <ToggleRow
            label="Notifiche in-app"
            value={notifInApp}
            onChange={(v) => { setNotifInApp(v); save({ notifInApp: v }) }}
          />
          <Divider />
          <ToggleRow
            label="Push web"
            value={notifPush}
            onChange={(v) => { setNotifPush(v); save({ notifPush: v }) }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)', margin: '0.625rem 0 0', lineHeight: 1.4 }}>
            Le notifiche sono inviate solo per messaggi importanti dei professionisti.
            Nessun contenuto sensibile viene inviato via Push/SMS.
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
            onChange={(v) => { setGeoEnabled(v); save({ geoEnabled: v }) }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)', margin: '0.625rem 0 0', lineHeight: 1.4 }}>
            Abilitazione della posizione per usare normative, alimenti e dati sanitari nazionali.
          </p>
        </Card>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '0.8125rem', fontWeight: 600,
      color: 'var(--color-text-secondary, #8E8E93)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      margin: '0 0 0.5rem 0.25rem',
    }}>
      {children}
    </h2>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface, #fff)',
      borderRadius: '1rem',
      padding: '0.875rem 1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {children}
    </div>
  )
}

function RowItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #8E8E93)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary, #1C1C1E)' }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', backgroundColor: 'var(--color-separator, #E5E5EA)', margin: '0.75rem 0' }} />
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary, #1C1C1E)' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: '2.875rem', height: '1.625rem', borderRadius: '999px', border: 'none',
          backgroundColor: value ? '#34C759' : 'var(--color-separator, #E5E5EA)',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background-color 0.2s', padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: '2px',
          left: value ? 'calc(100% - 22px)' : '2px',
          width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}

const actionButtonStyle: React.CSSProperties = {
  width: '100%', padding: '0.875rem', borderRadius: '1rem',
  border: '1px solid', backgroundColor: 'transparent',
  fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
}
