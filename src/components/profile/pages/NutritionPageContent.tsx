'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'

interface NutritionData {
  dietType: string
  intolerances: string
  preferences: string
  caloricGoal: string
  mealsPerDay: string
}

const DIET_TYPES = [
  { value: '', label: 'Seleziona...' },
  { value: 'onnivora', label: 'Onnivora' },
  { value: 'vegetariana', label: 'Vegetariana' },
  { value: 'vegana', label: 'Vegana' },
  { value: 'pescetariana', label: 'Pescetariana' },
  { value: 'chetogenica', label: 'Chetogenica' },
  { value: 'mediterranea', label: 'Mediterranea' },
  { value: 'altro', label: 'Altro' },
]

export function NutritionPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  const [form, setForm] = useState<NutritionData>({
    dietType: '',
    intolerances: '',
    preferences: '',
    caloricGoal: '',
    mealsPerDay: '3',
  })

  useEffect(() => {
    if (!profile?.nutrition) return
    const n = profile.nutrition as Partial<NutritionData>
    setForm({
      dietType: n.dietType || '',
      intolerances: n.intolerances || '',
      preferences: n.preferences || '',
      caloricGoal: n.caloricGoal || '',
      mealsPerDay: n.mealsPerDay || '3',
    })
  }, [profile])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('nutrition', form)
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-semibold text-on-surface">Nutrizione</h2>
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
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Nutrizione</h2>
      <p className="text-sm text-on-surface-muted">
        Preferenze alimentari per consigli nutrizionali su misura.
      </p>

      <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
        <div>
          <label htmlFor="dietType" className={labelClass}>Tipo di dieta</label>
          <select id="dietType" value={form.dietType} onChange={(e) => setForm({ ...form, dietType: e.target.value })} className={selectClass}>
            {DIET_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="intolerances" className={labelClass}>Intolleranze alimentari</label>
          <input
            id="intolerances"
            type="text"
            value={form.intolerances}
            onChange={(e) => setForm({ ...form, intolerances: e.target.value })}
            className={inputClass}
            placeholder="Es. glutine, lattosio, frutta a guscio..."
          />
        </div>

        <div>
          <label htmlFor="preferences" className={labelClass}>Cibi preferiti o da evitare</label>
          <textarea
            id="preferences"
            rows={2}
            value={form.preferences}
            onChange={(e) => setForm({ ...form, preferences: e.target.value })}
            className={inputClass}
            placeholder="Es. amo il pesce, evito i funghi..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="caloricGoal" className={labelClass}>Obiettivo calorico (kcal)</label>
            <input
              id="caloricGoal"
              type="number"
              min="800"
              max="6000"
              value={form.caloricGoal}
              onChange={(e) => setForm({ ...form, caloricGoal: e.target.value })}
              className={inputClass}
              placeholder="2000"
            />
          </div>
          <div>
            <label htmlFor="mealsPerDay" className={labelClass}>Pasti al giorno</label>
            <select id="mealsPerDay" value={form.mealsPerDay} onChange={(e) => setForm({ ...form, mealsPerDay: e.target.value })} className={selectClass}>
              {['2', '3', '4', '5', '6'].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </ProfileForm>
    </div>
  )
}
