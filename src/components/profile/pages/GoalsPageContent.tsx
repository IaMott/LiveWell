'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass } from '../ProfileForm'

interface GoalsData {
  shortTerm: string
  mediumTerm: string
  longTerm: string
}

export function GoalsPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  const [form, setForm] = useState<GoalsData>({
    shortTerm: '',
    mediumTerm: '',
    longTerm: '',
  })

  useEffect(() => {
    if (!profile?.goals) return
    const g = profile.goals as Partial<GoalsData>
    setForm({
      shortTerm: g.shortTerm || '',
      mediumTerm: g.mediumTerm || '',
      longTerm: g.longTerm || '',
    })
  }, [profile])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('goals', form)
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-semibold text-on-surface">Obiettivi</h2>
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
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Obiettivi</h2>
      <p className="text-sm text-on-surface-muted">
        Definisci i tuoi traguardi per guidare i consigli degli specialisti.
      </p>

      <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
        <div>
          <label htmlFor="shortTerm" className={labelClass}>
            Breve termine (1-3 mesi)
          </label>
          <textarea
            id="shortTerm"
            rows={3}
            value={form.shortTerm}
            onChange={(e) => setForm({ ...form, shortTerm: e.target.value })}
            className={inputClass}
            placeholder="Es. perdere 3kg, iniziare a correre, dormire meglio..."
          />
        </div>

        <div>
          <label htmlFor="mediumTerm" className={labelClass}>
            Medio termine (3-12 mesi)
          </label>
          <textarea
            id="mediumTerm"
            rows={3}
            value={form.mediumTerm}
            onChange={(e) => setForm({ ...form, mediumTerm: e.target.value })}
            className={inputClass}
            placeholder="Es. correre una 10km, raggiungere il peso forma..."
          />
        </div>

        <div>
          <label htmlFor="longTerm" className={labelClass}>
            Lungo termine (1+ anno)
          </label>
          <textarea
            id="longTerm"
            rows={3}
            value={form.longTerm}
            onChange={(e) => setForm({ ...form, longTerm: e.target.value })}
            className={inputClass}
            placeholder="Es. completare una maratona, stile di vita sano sostenibile..."
          />
        </div>
      </ProfileForm>
    </div>
  )
}
