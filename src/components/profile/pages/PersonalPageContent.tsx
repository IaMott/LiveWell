'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'

export function PersonalPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  useEffect(() => {
    if (!profile) return
    setBirthDate(profile.birthDate ? profile.birthDate.slice(0, 10) : '')
    setGender(profile.gender || '')
    setHeight(profile.height ? String(profile.height) : '')
    setWeight(profile.weight ? String(profile.weight) : '')
  }, [profile])

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then(() => {
        // Name comes from user model — fetch separately
        fetch('/api/auth/me')
          .then((r) => r.json())
          .then((d) => setName(d.user?.name || ''))
          .catch(() => {})
      })
      .catch(() => {})
  }, [])

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

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-semibold text-on-surface">Dati Personali</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Dati Personali</h2>
      <p className="text-sm text-on-surface-muted">
        Informazioni di base utilizzate dagli specialisti per personalizzare i consigli.
      </p>

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
    </div>
  )
}
