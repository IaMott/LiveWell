'use client'

import { useState, type FormEvent } from 'react'
import { type ProfileData } from '@/hooks/useProfile'
import { useProfileState } from '../ProfileStateProvider'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'
import { SectionCompletenessHint } from '../SectionCompletenessHint'

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

function NutritionForm({
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
  const n = (profile?.nutrition || {}) as Partial<NutritionData>
  const [form, setForm] = useState<NutritionData>({
    dietType: n.dietType || '',
    intolerances: n.intolerances || '',
    preferences: n.preferences || '',
    caloricGoal: n.caloricGoal || '',
    mealsPerDay: n.mealsPerDay || '3',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('nutrition', form)
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="dietType" className={labelClass}>
          Tipo di dieta
        </label>
        <select
          id="dietType"
          value={form.dietType}
          onChange={(e) => setForm({ ...form, dietType: e.target.value })}
          className={selectClass}
        >
          {DIET_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="intolerances" className={labelClass}>
          Intolleranze alimentari
        </label>
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
        <label htmlFor="preferences" className={labelClass}>
          Cibi preferiti o da evitare
        </label>
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
          <label htmlFor="caloricGoal" className={labelClass}>
            Obiettivo calorico (kcal)
          </label>
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
          <label htmlFor="mealsPerDay" className={labelClass}>
            Pasti al giorno
          </label>
          <select
            id="mealsPerDay"
            value={form.mealsPerDay}
            onChange={(e) => setForm({ ...form, mealsPerDay: e.target.value })}
            className={selectClass}
          >
            {['2', '3', '4', '5', '6'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ProfileForm>
  )
}

export function NutritionPageContent() {
  const {
    profile,
    loading,
    saving,
    error,
    success,
    saveSection,
    getSectionCompleteness,
    completenessLoading,
    completenessError,
  } = useProfileState()

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Nutrizione</h2>
      <p className="text-sm text-on-surface-muted">
        Preferenze alimentari per consigli nutrizionali su misura.
      </p>
      <SectionCompletenessHint
        sectionData={getSectionCompleteness('nutrition')}
        loading={completenessLoading}
        error={completenessError}
      />
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      ) : (
        <NutritionForm
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
