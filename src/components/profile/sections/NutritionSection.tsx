'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function NutritionSection({ data }: Props) {
  const { stats, recentMeals, profile } = data
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const nutritionProfile = profile?.nutrition as Record<string, unknown> | null
  const [form, setForm] = useState({
    dailyKcal: nutritionProfile?.dailyKcal != null ? String(nutritionProfile.dailyKcal) : '',
    dietType: nutritionProfile?.dietType != null ? String(nutritionProfile.dietType) : '',
    meals: nutritionProfile?.meals != null ? String(nutritionProfile.meals) : '',
    allergies: nutritionProfile?.allergies != null ? String(nutritionProfile.allergies) : '',
  })

  const dailyKcal = nutritionProfile?.dailyKcal != null ? Number(nutritionProfile.dailyKcal) : null

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'nutrition',
          data: {
            dailyKcal: form.dailyKcal ? Number(form.dailyKcal) : undefined,
            dietType: form.dietType || undefined,
            meals: form.meals ? Number(form.meals) : undefined,
            allergies: form.allergies || undefined,
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
      {/* Edit card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '1rem',
          padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Nutrizione
          </h2>
          <button
            onClick={() => setEditing((v) => !v)}
            style={editButtonStyle}
          >
            <Pencil size={12} />
            {editing ? 'Annulla' : 'Modifica'}
          </button>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Row label="Dieta" value={nutritionProfile?.dietType ? String(nutritionProfile.dietType) : '—'} />
            <Row label="Kcal/giorno" value={dailyKcal != null ? `${dailyKcal} kcal` : '—'} />
            <Row label="Pasti/giorno" value={nutritionProfile?.meals != null ? String(nutritionProfile.meals) : '—'} />
            <Row label="Allergie" value={nutritionProfile?.allergies ? String(nutritionProfile.allergies) : '—'} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="Tipo di dieta">
              <select
                value={form.dietType}
                onChange={(e) => setForm((f) => ({ ...f, dietType: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Seleziona</option>
                <option value="onnivoro">Onnivoro</option>
                <option value="vegetariano">Vegetariano</option>
                <option value="vegano">Vegano</option>
                <option value="pescetariano">Pescetariano</option>
                <option value="senza-glutine">Senza glutine</option>
                <option value="senza-lattosio">Senza lattosio</option>
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Field label="Obiettivo kcal/giorno">
                <input
                  type="number"
                  value={form.dailyKcal}
                  onChange={(e) => setForm((f) => ({ ...f, dailyKcal: e.target.value }))}
                  placeholder="2000"
                  min={800}
                  max={5000}
                  style={inputStyle}
                />
              </Field>
              <Field label="Pasti al giorno">
                <input
                  type="number"
                  value={form.meals}
                  onChange={(e) => setForm((f) => ({ ...f, meals: e.target.value }))}
                  placeholder="3"
                  min={1}
                  max={8}
                  style={inputStyle}
                />
              </Field>
            </div>
            <Field label="Allergie / intolleranze">
              <input
                value={form.allergies}
                onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                placeholder="es: lattosio, arachidi"
                style={inputStyle}
              />
            </Field>
            <button onClick={save} disabled={saving} style={saveButtonStyle}>
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        <StatCard label="Pasti (7gg)" value={stats.mealsLogged7d} color="#AF52DE" />
        {dailyKcal !== null && (
          <StatCard label="Obiettivo kcal" value={dailyKcal} unit="kcal" color="#AF52DE" />
        )}
      </div>

      {recentMeals.length > 0 ? (
        <section>
          <h2 style={sectionTitleStyle}>Ultimi pasti</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentMeals.map((meal) => (
              <div key={meal.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                    {meal.mealType}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {new Date(meal.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {meal.notes && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {meal.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          message="Nessun pasto registrato questa settimana. Il tuo dietista ti guiderà nella raccolta dei dati."
          cta="Parla con il dietista"
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const editButtonStyle: React.CSSProperties = {
  padding: '0.25rem 0.625rem',
  borderRadius: '999px',
  border: '1px solid var(--color-separator)',
  background: 'transparent',
  color: 'var(--color-accent)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.625rem',
  border: '1px solid var(--color-separator)',
  backgroundColor: 'var(--color-bg)',
  fontSize: '0.9375rem',
  color: 'var(--color-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

const saveButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '0.75rem',
  border: 'none',
  backgroundColor: '#AF52DE',
  color: '#fff',
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '0.25rem',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 0.5rem',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderRadius: '1rem',
  padding: '0.875rem 1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
