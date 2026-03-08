'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function HealthSection({ data }: Props) {
  const { profile, stats } = data
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [addingWeight, setAddingWeight] = useState(false)
  const [saving, setSaving] = useState(false)
  const [weightSaving, setWeightSaving] = useState(false)
  const healthProfile = profile?.health as Record<string, unknown> | null
  const [form, setForm] = useState({
    conditions: healthProfile?.conditions != null ? String(healthProfile.conditions) : '',
    medications: healthProfile?.medications != null ? String(healthProfile.medications) : '',
    surgeries: healthProfile?.surgeries != null ? String(healthProfile.surgeries) : '',
    allergies: healthProfile?.allergies != null ? String(healthProfile.allergies) : '',
    smokingStatus: healthProfile?.smokingStatus != null ? String(healthProfile.smokingStatus) : '',
    alcoholFrequency: healthProfile?.alcoholFrequency != null ? String(healthProfile.alcoholFrequency) : '',
  })
  const [weightForm, setWeightForm] = useState({ value: '', unit: 'kg' })

  async function saveProfile() {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'health',
          data: {
            conditions: form.conditions || undefined,
            medications: form.medications || undefined,
            surgeries: form.surgeries || undefined,
            allergies: form.allergies || undefined,
            smokingStatus: form.smokingStatus || undefined,
            alcoholFrequency: form.alcoholFrequency || undefined,
          },
        }),
      })
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function addWeight() {
    if (!weightForm.value) return
    setWeightSaving(true)
    try {
      await fetch('/api/trackers/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: Number(weightForm.value), unit: weightForm.unit }),
      })
      setAddingWeight(false)
      setWeightForm({ value: '', unit: 'kg' })
      router.refresh()
    } finally {
      setWeightSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Edit card */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={labelStyle}>Salute</h2>
          <button onClick={() => setEditing((v) => !v)} style={editButtonStyle}>
            <Pencil size={12} />
            {editing ? 'Annulla' : 'Modifica'}
          </button>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Row label="Patologie" value={healthProfile?.conditions ? String(healthProfile.conditions) : '—'} />
            <Row label="Farmaci" value={healthProfile?.medications ? String(healthProfile.medications) : '—'} />
            <Row label="Interventi pregressi" value={healthProfile?.surgeries ? String(healthProfile.surgeries) : '—'} />
            <Row label="Allergie" value={healthProfile?.allergies ? String(healthProfile.allergies) : '—'} />
            <Row label="Fumo" value={healthProfile?.smokingStatus ? String(healthProfile.smokingStatus) : '—'} />
            <Row label="Alcol" value={healthProfile?.alcoholFrequency ? String(healthProfile.alcoholFrequency) : '—'} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="Patologie croniche / condizioni">
              <textarea value={form.conditions} onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))} placeholder="es: ipertensione, diabete tipo 2, asma…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <Field label="Farmaci in uso">
              <textarea value={form.medications} onChange={(e) => setForm((f) => ({ ...f, medications: e.target.value }))} placeholder="es: metformina 500mg, ramipril 5mg…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <Field label="Interventi chirurgici pregressi">
              <input value={form.surgeries} onChange={(e) => setForm((f) => ({ ...f, surgeries: e.target.value }))} placeholder="es: appendicite (2015), menisco (2020)" style={inputStyle} />
            </Field>
            <Field label="Allergie / intolleranze">
              <input value={form.allergies} onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))} placeholder="es: penicillina, arachidi" style={inputStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Field label="Fumo">
                <select value={form.smokingStatus} onChange={(e) => setForm((f) => ({ ...f, smokingStatus: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  <option value="non-fumatore">Non fumatore</option>
                  <option value="ex-fumatore">Ex fumatore</option>
                  <option value="fumatore">Fumatore</option>
                </select>
              </Field>
              <Field label="Alcol">
                <select value={form.alcoholFrequency} onChange={(e) => setForm((f) => ({ ...f, alcoholFrequency: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  <option value="mai">Mai</option>
                  <option value="occasionale">Occasionale</option>
                  <option value="moderato">Moderato</option>
                  <option value="frequente">Frequente</option>
                </select>
              </Field>
            </div>
            <button onClick={saveProfile} disabled={saving} style={{ ...saveButtonStyle, backgroundColor: '#34C759' }}>
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        )}
      </div>

      {/* Weight stats + quick-add */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={sectionTitleStyle}>Peso corporeo</h2>
          <button onClick={() => setAddingWeight((v) => !v)} style={addButtonStyle}>
            <Plus size={13} />
            {addingWeight ? 'Annulla' : 'Registra'}
          </button>
        </div>

        {addingWeight && (
          <div style={{ ...panelStyle, marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <div style={{ flex: 1 }}>
                <Field label="Peso">
                  <input
                    type="number"
                    value={weightForm.value}
                    onChange={(e) => setWeightForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder="70.5"
                    min={20}
                    max={500}
                    step={0.1}
                    style={inputStyle}
                    autoFocus
                  />
                </Field>
              </div>
              <div style={{ width: '80px' }}>
                <Field label="Unità">
                  <select value={weightForm.unit} onChange={(e) => setWeightForm((f) => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </Field>
              </div>
            </div>
            <button onClick={addWeight} disabled={weightSaving || !weightForm.value} style={{ ...saveButtonStyle, backgroundColor: '#34C759' }}>
              {weightSaving ? 'Salvataggio…' : 'Registra peso'}
            </button>
          </div>
        )}

        {stats.lastWeightEntry || stats.avgMood7d != null ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {stats.lastWeightEntry && (
              <StatCard label="Ultimo peso" value={stats.lastWeightEntry.value} unit={stats.lastWeightEntry.unit} color="#34C759" />
            )}
            {stats.avgMood7d != null && (
              <StatCard label="Umore medio" value={Math.round(stats.avgMood7d * 10) / 10} unit="/10" color="#5AC8FA" />
            )}
          </div>
        ) : !addingWeight ? (
          <EmptyState
            message="Nessuna misurazione registrata. Il tuo medico di base ti guiderà nel monitoraggio della salute."
            cta="Parla con il medico"
          />
        ) : null}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{label}</label>
      {children}
    </div>
  )
}

const panelStyle: React.CSSProperties = { backgroundColor: 'var(--color-surface)', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const labelStyle: React.CSSProperties = { margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const editButtonStyle: React.CSSProperties = { padding: '0.25rem 0.625rem', borderRadius: '999px', border: '1px solid var(--color-separator)', background: 'transparent', color: 'var(--color-accent)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }
const addButtonStyle: React.CSSProperties = { ...editButtonStyle, color: '#34C759', borderColor: '#34C75930' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1px solid var(--color-separator)', backgroundColor: 'var(--color-bg)', fontSize: '0.9375rem', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }
const saveButtonStyle: React.CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', color: '#fff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.25rem' }
