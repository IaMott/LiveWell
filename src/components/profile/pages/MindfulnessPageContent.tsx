'use client'

import { useState, type FormEvent } from 'react'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'

interface MindfulnessData {
  stressLevel: string
  meditationExp: string
  techniques: string
  sleepHours: string
}

const STRESS_LEVELS = [
  { value: '', label: 'Seleziona...' },
  { value: 'basso', label: 'Basso' },
  { value: 'moderato', label: 'Moderato' },
  { value: 'alto', label: 'Alto' },
  { value: 'molto_alto', label: 'Molto alto' },
]

const MEDITATION_EXP = [
  { value: '', label: 'Seleziona...' },
  { value: 'nessuna', label: 'Nessuna esperienza' },
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Praticante regolare' },
  { value: 'avanzato', label: 'Praticante avanzato' },
]

function MindfulnessForm({ profile, saving, error, success, saveSection }: {
  profile: ProfileData | null
  saving: boolean
  error: string
  success: string
  saveSection: (section: string, data: object) => void
}) {
  const m = (profile?.mindfulness || {}) as Partial<MindfulnessData>
  const [form, setForm] = useState<MindfulnessData>({
    stressLevel: m.stressLevel || '',
    meditationExp: m.meditationExp || '',
    techniques: m.techniques || '',
    sleepHours: m.sleepHours || '7',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('mindfulness', form)
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="stressLevel" className={labelClass}>Livello di stress attuale</label>
        <select id="stressLevel" value={form.stressLevel} onChange={(e) => setForm({ ...form, stressLevel: e.target.value })} className={selectClass}>
          {STRESS_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="meditationExp" className={labelClass}>Esperienza con la meditazione</label>
        <select id="meditationExp" value={form.meditationExp} onChange={(e) => setForm({ ...form, meditationExp: e.target.value })} className={selectClass}>
          {MEDITATION_EXP.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sleepHours" className={labelClass}>Ore di sonno medie</label>
        <select id="sleepHours" value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} className={selectClass}>
          {['4', '5', '6', '7', '8', '9', '10'].map((n) => (
            <option key={n} value={n}>{n}h</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="techniques" className={labelClass}>Tecniche di rilassamento conosciute</label>
        <textarea id="techniques" rows={2} value={form.techniques} onChange={(e) => setForm({ ...form, techniques: e.target.value })} className={inputClass} placeholder="Es. respirazione diaframmatica, yoga, journaling..." />
      </div>
    </ProfileForm>
  )
}

export function MindfulnessPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Mindfulness</h2>
      <p className="text-sm text-on-surface-muted">
        Il tuo livello di benessere mentale e le tue pratiche.
      </p>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      ) : (
        <MindfulnessForm key={String(!!profile)} profile={profile} saving={saving} error={error} success={success} saveSection={saveSection} />
      )}
    </div>
  )
}
