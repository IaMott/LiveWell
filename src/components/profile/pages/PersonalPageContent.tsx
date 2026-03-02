'use client'

import { useState, type FormEvent } from 'react'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'

function PersonalForm({ profile, saving, error, success, saveSection }: {
  profile: ProfileData | null
  saving: boolean
  error: string
  success: string
  saveSection: (section: string, data: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState(profile?.birthDate ? profile.birthDate.slice(0, 10) : '')
  const [gender, setGender] = useState(profile?.gender || '')
  const [height, setHeight] = useState(profile?.height ? String(profile.height) : '')
  const [weight, setWeight] = useState(profile?.weight ? String(profile.weight) : '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('personal', {
      name,
      birthDate: birthDate || null,
      gender: gender || null,
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
    })
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="name" className={labelClass}>Nome</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Il tuo nome" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="birthDate" className={labelClass}>Data di nascita</label>
          <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="gender" className={labelClass}>Sesso</label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
            <option value="">Seleziona...</option>
            <option value="M">Maschile</option>
            <option value="F">Femminile</option>
            <option value="altro">Altro</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="height" className={labelClass}>Altezza (cm)</label>
          <input id="height" type="number" min="100" max="250" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} placeholder="175" />
        </div>
        <div>
          <label htmlFor="weight" className={labelClass}>Peso (kg)</label>
          <input id="weight" type="number" min="20" max="300" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} placeholder="70" />
        </div>
      </div>
    </ProfileForm>
  )
}

export function PersonalPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Dati Personali</h2>
      <p className="text-sm text-on-surface-muted">
        Informazioni di base utilizzate dagli specialisti per personalizzare i consigli.
      </p>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      ) : (
        <PersonalForm key={String(!!profile)} profile={profile} saving={saving} error={error} success={success} saveSection={saveSection} />
      )}
    </div>
  )
}
