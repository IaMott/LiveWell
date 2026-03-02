'use client'

import { useState, type FormEvent } from 'react'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { ProfileForm, inputClass, labelClass, selectClass } from '../ProfileForm'

interface HealthData {
  conditions: string
  allergies: string
  medications: string
  bloodType: string
  notes: string
}

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']

function HealthForm({ profile, saving, error, success, saveSection }: {
  profile: ProfileData | null
  saving: boolean
  error: string
  success: string
  saveSection: (section: string, data: Record<string, unknown>) => void
}) {
  const h = (profile?.health || {}) as Partial<HealthData>
  const [form, setForm] = useState<HealthData>({
    conditions: h.conditions || '',
    allergies: h.allergies || '',
    medications: h.medications || '',
    bloodType: h.bloodType || '',
    notes: h.notes || '',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveSection('health', form)
  }

  return (
    <ProfileForm onSubmit={handleSubmit} saving={saving} error={error} success={success}>
      <div>
        <label htmlFor="conditions" className={labelClass}>Patologie o condizioni</label>
        <textarea id="conditions" rows={3} value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} className={inputClass} placeholder="Es. diabete tipo 2, ipertensione..." />
      </div>
      <div>
        <label htmlFor="allergies" className={labelClass}>Allergie</label>
        <input id="allergies" type="text" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} className={inputClass} placeholder="Es. lattosio, nichel, polline..." />
      </div>
      <div>
        <label htmlFor="medications" className={labelClass}>Farmaci in uso</label>
        <input id="medications" type="text" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} className={inputClass} placeholder="Es. metformina, enalapril..." />
      </div>
      <div>
        <label htmlFor="bloodType" className={labelClass}>Gruppo sanguigno</label>
        <select id="bloodType" value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} className={selectClass}>
          {BLOOD_TYPES.map((bt) => (
            <option key={bt} value={bt}>{bt || 'Seleziona...'}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="healthNotes" className={labelClass}>Note aggiuntive</label>
        <textarea id="healthNotes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Altre informazioni rilevanti..." />
      </div>
    </ProfileForm>
  )
}

export function HealthPageContent() {
  const { profile, loading, saving, error, success, saveSection } = useProfile()

  return (
    <div className="space-y-4">
      <h2 className="pt-4 text-xl font-semibold text-on-surface">Salute</h2>
      <p className="text-sm text-on-surface-muted">
        Informazioni sanitarie per consigli più sicuri e personalizzati.
      </p>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-[var(--radius-card)] bg-surface-dim" />
          ))}
        </div>
      ) : (
        <HealthForm key={String(!!profile)} profile={profile} saving={saving} error={error} success={success} saveSection={saveSection} />
      )}
    </div>
  )
}
