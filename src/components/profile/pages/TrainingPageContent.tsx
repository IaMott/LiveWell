'use client'

import { useState, type FormEvent } from 'react'
import { type ProfileData } from '@/hooks/useProfile'
import { useProfileState } from '../ProfileStateProvider'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'
import { SectionCompletenessHint } from '../SectionCompletenessHint'

interface TrainingData {
  fitnessLevel: string
  equipment: string
  weeklyDays: string
  injuries: string
  sport: string
}

const FITNESS_LEVELS = [
  { value: '', label: 'Seleziona...' },
  { value: 'sedentario', label: 'Sedentario' },
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzato', label: 'Avanzato' },
  { value: 'atleta', label: 'Atleta' },
]

function TrainingForm({
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
  const t = (profile?.training || {}) as Partial<TrainingData>
  const [form, setForm] = useState<TrainingData>({
    fitnessLevel: t.fitnessLevel || '',
    equipment: t.equipment || '',
    weeklyDays: t.weeklyDays || '3',
    injuries: t.injuries || '',
    sport: t.sport || '',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('training', form)
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="fitnessLevel" className={labelClass}>
          Livello di fitness
        </label>
        <select
          id="fitnessLevel"
          value={form.fitnessLevel}
          onChange={(e) => setForm({ ...form, fitnessLevel: e.target.value })}
          className={selectClass}
        >
          {FITNESS_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sport" className={labelClass}>
          Sport praticati
        </label>
        <input
          id="sport"
          type="text"
          value={form.sport}
          onChange={(e) => setForm({ ...form, sport: e.target.value })}
          className={inputClass}
          placeholder="Es. corsa, nuoto, palestra, calcio..."
        />
      </div>
      <div>
        <label htmlFor="weeklyDays" className={labelClass}>
          Giorni di allenamento a settimana
        </label>
        <select
          id="weeklyDays"
          value={form.weeklyDays}
          onChange={(e) => setForm({ ...form, weeklyDays: e.target.value })}
          className={selectClass}
        >
          {['1', '2', '3', '4', '5', '6', '7'].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="equipment" className={labelClass}>
          Attrezzatura disponibile
        </label>
        <input
          id="equipment"
          type="text"
          value={form.equipment}
          onChange={(e) => setForm({ ...form, equipment: e.target.value })}
          className={inputClass}
          placeholder="Es. manubri, bilanciere, TRX, nessuna..."
        />
      </div>
      <div>
        <label htmlFor="injuries" className={labelClass}>
          Infortuni o limitazioni
        </label>
        <textarea
          id="injuries"
          rows={2}
          value={form.injuries}
          onChange={(e) => setForm({ ...form, injuries: e.target.value })}
          className={inputClass}
          placeholder="Es. ernia lombare, ginocchio operato..."
        />
      </div>
    </ProfileForm>
  )
}

export function TrainingPageContent() {
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
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Allenamento</h2>
      <p className="text-sm text-on-surface-muted">
        Il tuo livello e le tue preferenze di allenamento.
      </p>
      <SectionCompletenessHint
        sectionData={getSectionCompleteness('training')}
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
        <TrainingForm
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
