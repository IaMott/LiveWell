'use client'

import { useState, type FormEvent } from 'react'
import { type ProfileData } from '@/hooks/useProfile'
import { useProfileState } from '../ProfileStateProvider'
import { ProfileForm, labelClass, selectClass } from '../ProfileForm'
import { cn } from '@/lib/utils'

interface SettingsData {
  notifications: boolean
  theme: string
  language: string
}

function SettingsForm({
  profile,
  saving,
  error,
  success,
  saveSection,
}: {
  profile: ProfileData | null
  saving: boolean
  error: string
  success: string
  saveSection: (section: string, data: object) => void
}) {
  const s = (profile?.settings || {}) as Partial<SettingsData>
  const [form, setForm] = useState<SettingsData>({
    notifications: s.notifications !== false,
    theme: s.theme || 'system',
    language: s.language || 'it',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('settings', form)
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="theme" className={labelClass}>
          Tema
        </label>
        <select
          id="theme"
          value={form.theme}
          onChange={(e) => setForm({ ...form, theme: e.target.value })}
          className={selectClass}
        >
          <option value="system">Sistema</option>
          <option value="light">Chiaro</option>
          <option value="dark">Scuro</option>
        </select>
      </div>
      <div>
        <label htmlFor="language" className={labelClass}>
          Lingua
        </label>
        <select
          id="language"
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
          className={selectClass}
        >
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="notifications" className={labelClass}>
          Notifiche
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={form.notifications}
          onClick={() => setForm({ ...form, notifications: !form.notifications })}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            form.notifications ? 'bg-brand-500' : 'bg-surface-dim',
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              form.notifications ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>
    </ProfileForm>
  )
}

export function SettingsPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfileState()

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Impostazioni</h2>
      <p className="text-sm text-on-surface-muted">Preferenze dell&apos;app e privacy.</p>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      ) : (
        <SettingsForm
          key={String(!!profile)}
          profile={profile}
          saving={saving}
          error={error}
          success={success}
          saveSection={saveSection}
        />
      )}
    </div>
  )
}
