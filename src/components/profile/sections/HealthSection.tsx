'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

export function HealthSection({ data }: Props) {
  const { profile, stats } = data
  const router = useRouter()
  const [addingWeight, setAddingWeight] = useState(false)
  const [weightSaving, setWeightSaving] = useState(false)
  const [weightForm, setWeightForm] = useState({ value: '', unit: 'kg' })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const healthProfile = profile?.health as Record<string, unknown> | null
  const [form, setForm] = useState({
    conditions: healthProfile?.conditions != null ? String(healthProfile.conditions) : '',
    medications: healthProfile?.medications != null ? String(healthProfile.medications) : '',
    allergies: healthProfile?.allergies != null ? String(healthProfile.allergies) : '',
    smokingStatus: healthProfile?.smokingStatus != null ? String(healthProfile.smokingStatus) : '',
  })

  const lastWeight = stats.lastWeightEntry

  async function saveWeight() {
    if (!weightForm.value) return
    setWeightSaving(true)
    try {
      await fetch('/api/profile/body-metric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricType: 'weight',
          value: Number(weightForm.value),
          unit: weightForm.unit,
        }),
      })
      setAddingWeight(false)
      setWeightForm({ value: '', unit: 'kg' })
      router.refresh()
    } finally {
      setWeightSaving(false)
    }
  }

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
            allergies: form.allergies || undefined,
            smokingStatus: form.smokingStatus || undefined,
          },
        }),
      })
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Vital signs */}
      <h3 style={sectionHeaderStyle}>Parametri Vitali</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {/* Weight card */}
        <div style={vitalCardStyle('#34C759')}>
          <p style={vitalLabelStyle}>Peso</p>
          <p style={{ ...vitalValueStyle, color: '#34C759' }}>
            {lastWeight ? `${lastWeight.value}` : '—'}
            <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '2px' }}>
              {lastWeight ? lastWeight.unit : 'kg'}
            </span>
          </p>
          {lastWeight && (
            <p
              style={{
                margin: 0,
                fontSize: '0.6875rem',
                color: 'var(--color-text-secondary, #8E8E93)',
              }}
            >
              {new Date(lastWeight.date).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
          <button
            type="button"
            onClick={() => setAddingWeight(true)}
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#34C759',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 600,
            }}
          >
            + Aggiorna
          </button>
        </div>

        {/* BMI card */}
        <div style={vitalCardStyle('#5AC8FA')}>
          <p style={vitalLabelStyle}>BMI</p>
          {profile?.height && lastWeight ? (
            <>
              <p style={{ ...vitalValueStyle, color: '#5AC8FA' }}>
                {(lastWeight.value / Math.pow(Number(profile.height) / 100, 2)).toFixed(1)}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-secondary, #8E8E93)',
                }}
              >
                {getBmiLabel(lastWeight.value / Math.pow(Number(profile.height) / 100, 2))}
              </p>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary, #8E8E93)',
              }}
            >
              Completa profilo
            </p>
          )}
        </div>
      </div>

      {/* Weight entry form */}
      {addingWeight && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              placeholder="70.5"
              value={weightForm.value}
              onChange={(e) => setWeightForm((f) => ({ ...f, value: e.target.value }))}
              style={{ ...inputStyle, flex: 2 }}
              min={30}
              max={300}
              step={0.1}
            />
            <select
              value={weightForm.unit}
              onChange={(e) => setWeightForm((f) => ({ ...f, unit: e.target.value }))}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setAddingWeight(false)}
              style={{
                ...btnStyle,
                backgroundColor: 'var(--color-bg, #F2F2F7)',
                color: 'var(--color-text-primary, #1C1C1E)',
                flex: 1,
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={saveWeight}
              disabled={weightSaving || !weightForm.value}
              style={{ ...btnStyle, backgroundColor: '#34C759', color: '#fff', flex: 2 }}
            >
              {weightSaving ? 'Salvataggio…' : 'Salva peso'}
            </button>
          </div>
        </div>
      )}

      {/* Health profile */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '0.25rem',
        }}
      >
        <h3 style={{ ...sectionHeaderStyle, margin: 0 }}>Profilo Clinico</h3>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-accent, #007AFF)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {editing ? 'Annulla' : 'Modifica'}
        </button>
      </div>

      {!editing ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '0 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {[
            { label: 'Patologie', value: healthProfile?.conditions as string | null },
            { label: 'Farmaci', value: healthProfile?.medications as string | null },
            { label: 'Allergie', value: healthProfile?.allergies as string | null },
            { label: 'Fumo', value: healthProfile?.smokingStatus as string | null },
          ].map(({ label, value }, i) => (
            <div key={label}>
              {i > 0 && (
                <div
                  style={{ height: '1px', backgroundColor: 'var(--color-separator, #E5E5EA)' }}
                />
              )}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}
              >
                <span
                  style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #8E8E93)' }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary, #1C1C1E)',
                    maxWidth: '55%',
                    textAlign: 'right',
                  }}
                >
                  {value || '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
          }}
        >
          {[
            { key: 'conditions' as const, label: 'Patologie o condizioni croniche' },
            { key: 'medications' as const, label: 'Farmaci assunti' },
            { key: 'allergies' as const, label: 'Allergie o intolleranze' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
          <div>
            <label style={labelStyle}>Fumo</label>
            <select
              value={form.smokingStatus}
              onChange={(e) => setForm((f) => ({ ...f, smokingStatus: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Seleziona</option>
              <option value="non_fumatore">Non fumatore</option>
              <option value="ex_fumatore">Ex fumatore</option>
              <option value="fumatore">Fumatore</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                ...btnStyle,
                backgroundColor: 'var(--color-bg, #F2F2F7)',
                color: 'var(--color-text-primary, #1C1C1E)',
                flex: 1,
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              style={{ ...btnStyle, backgroundColor: '#34C759', color: '#fff', flex: 2 }}
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      {/* Tip */}
      <div
        style={{
          backgroundColor: 'rgba(52,199,89,0.1)',
          borderRadius: '1rem',
          padding: '0.875rem 1rem',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            color: '#34C759',
            fontWeight: 600,
            marginBottom: '0.25rem',
          }}
        >
          💡 Suggerimento
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary, #8E8E93)',
            lineHeight: 1.4,
          }}
        >
          Parla con il team nella chat per ricevere analisi personalizzate dei tuoi parametri di
          salute.
        </p>
      </div>
    </div>
  )
}

function getBmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'Sottopeso'
  if (bmi < 25) return 'Normopeso'
  if (bmi < 30) return 'Sovrappeso'
  return 'Obesità'
}

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
const vitalCardStyle = (color: string): React.CSSProperties => ({
  backgroundColor: 'var(--color-surface, #fff)',
  borderRadius: '1rem',
  padding: '0.875rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  borderTop: `3px solid ${color}`,
})
const vitalLabelStyle: React.CSSProperties = {
  margin: '0 0 0.25rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}
const vitalValueStyle: React.CSSProperties = {
  margin: '0 0 0.125rem',
  fontSize: '1.5rem',
  fontWeight: 700,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.625rem',
  border: '1px solid var(--color-separator, #E5E5EA)',
  backgroundColor: 'var(--color-bg, #F2F2F7)',
  fontSize: '0.9375rem',
  color: 'var(--color-text-primary, #1C1C1E)',
  outline: 'none',
  boxSizing: 'border-box',
}
const btnStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderRadius: '0.75rem',
  border: 'none',
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  marginBottom: '0.25rem',
}
