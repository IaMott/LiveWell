'use client'

import { useState, type FormEvent } from 'react'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass } from '../ProfileForm'

interface GoalsData {
  shortTerm: string
  mediumTerm: string
  longTerm: string
}

function GoalsForm({ profile, saving, error, success, saveSection }: {
  profile: ProfileData | null
  saving: boolean
  error: string
  success: string
  saveSection: (section: string, data: Record<string, unknown>) => void
}) {
  const g = (profile?.goals || {}) as Partial<GoalsData>
  const [form, setForm] = useState<GoalsData>({
    shortTerm: g.shortTerm || '',
    mediumTerm: g.mediumTerm || '',
    longTerm: g.longTerm || '',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('goals', form)
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="shortTerm" className={labelClass}>Breve termine (1-3 mesi)</label>
        <textarea id="shortTerm" rows={3} value={form.shortTerm} onChange={(e) => setForm({ ...form, shortTerm: e.target.value })} className={inputClass} placeholder="Es. perdere 3kg, iniziare a correre, dormire meglio..." />
      </div>
      <div>
        <label htmlFor="mediumTerm" className={labelClass}>Medio termine (3-12 mesi)</label>
        <textarea id="mediumTerm" rows={3} value={form.mediumTerm} onChange={(e) => setForm({ ...form, mediumTerm: e.target.value })} className={inputClass} placeholder="Es. correre una 10km, raggiungere il peso forma..." />
      </div>
      <div>
        <label htmlFor="longTerm" className={labelClass}>Lungo termine (1+ anno)</label>
        <textarea id="longTerm" rows={3} value={form.longTerm} onChange={(e) => setForm({ ...form, longTerm: e.target.value })} className={inputClass} placeholder="Es. completare una maratona, stile di vita sano sostenibile..." />
      </div>
    </ProfileForm>
  )
}

export function GoalsPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Obiettivi</h2>
      <p className="text-sm text-on-surface-muted">
        Definisci i tuoi traguardi per guidare i consigli degli specialisti.
      </p>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      ) : (
        <GoalsForm key={String(!!profile)} profile={profile} saving={saving} error={error} success={success} saveSection={saveSection} />
      )}
    </div>
  )
}
