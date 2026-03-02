'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { ProfileForm, labelClass, selectClass } from '../ProfileForm'
import { cn } from '@/lib/utils'

interface SettingsData {
  notifications: boolean
  theme: string
  language: string
}

export function SettingsPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  const [form, setForm] = useState<SettingsData>({
    notifications: true,
    theme: 'system',
    language: 'it',
  })

  useEffect(() => {
    if (!profile?.settings) return
    const s = profile.settings as Partial<SettingsData>
    setForm({
      notifications: s.notifications !== false,
      theme: s.theme || 'system',
      language: s.language || 'it',
    })
  }, [profile])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('settings', form)
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-semibold text-on-surface">Impostazioni</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Impostazioni</h2>
      <p className="text-sm text-on-surface-muted">
        Preferenze dell&apos;app e privacy.
      </p>

      <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
        <div>
          <label htmlFor="theme" className={labelClass}>Tema</label>
          <select id="theme" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} className={selectClass}>
            <option value="system">Sistema</option>
            <option value="light">Chiaro</option>
            <option value="dark">Scuro</option>
          </select>
        </div>

        <div>
          <label htmlFor="language" className={labelClass}>Lingua</label>
          <select id="language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={selectClass}>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="notifications" className={labelClass}>Notifiche</label>
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
    </div>
  )
}
