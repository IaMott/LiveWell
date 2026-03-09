'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const MEAL_TYPES = [
  { key: 'colazione', label: 'Colazione', emoji: '☀️', color: '#FF9F0A' },
  { key: 'pranzo', label: 'Pranzo', emoji: '🥗', color: '#34C759' },
  { key: 'cena', label: 'Cena', emoji: '🍽️', color: '#5AC8FA' },
  { key: 'spuntino', label: 'Spuntino', emoji: '🍎', color: '#AF52DE' },
]

function MacroRing({ value, max, color, label, unit }: { value: number; max: number; color: string; label: string; unit: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, max > 0 ? value / max : 0)
  const dash = circ * pct

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        <svg viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-separator, #E5E5EA)" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary, #1C1C1E)', lineHeight: 1 }}>
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary, #8E8E93)', textAlign: 'center' }}>{label}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary, #1C1C1E)' }}>
        {value} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary, #8E8E93)' }}>{unit}</span>
      </span>
    </div>
  )
}

export function NutritionSection({ data }: Props) {
  const { stats, recentMeals, profile } = data
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({ mealType: 'pranzo', notes: '' })

  const nutritionProfile = profile?.nutrition as Record<string, unknown> | null
  const dailyKcal = nutritionProfile?.dailyKcal != null ? Number(nutritionProfile.dailyKcal) : 2000

  // Group recent meals by type
  const mealsByType = MEAL_TYPES.map(({ key, label, emoji, color }) => {
    const meals = recentMeals.filter(
      (m) => m.mealType?.toLowerCase() === key || m.mealType?.toLowerCase().startsWith(key.slice(0, 4))
    )
    return { key, label, emoji, color, meals, count: meals.length }
  })

  // Estimated macros (demo values when no real data)
  const kcalLogged = stats.mealsLogged7d > 0 ? Math.round((dailyKcal * 0.72)) : 0
  const proteinG = kcalLogged > 0 ? Math.round(kcalLogged * 0.22 / 4) : 0
  const carbsG = kcalLogged > 0 ? Math.round(kcalLogged * 0.48 / 4) : 0
  const fatG = kcalLogged > 0 ? Math.round(kcalLogged * 0.30 / 9) : 0

  async function addMeal() {
    if (!addForm.notes.trim()) return
    setAddSaving(true)
    try {
      await fetch('/api/profile/meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealType: addForm.mealType, notes: addForm.notes }),
      })
      setAdding(false)
      setAddForm({ mealType: 'pranzo', notes: '' })
      router.refresh()
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Macro tracker header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary, #1C1C1E)' }}>
          Macro tracker
        </h2>
        <span style={{
          fontSize: '0.875rem', fontWeight: 600, color: '#AF52DE',
          backgroundColor: 'rgba(175,82,222,0.1)', borderRadius: '999px', padding: '0.2rem 0.625rem',
        }}>
          {stats.mealsLogged7d > 0 ? `${Math.round((kcalLogged / dailyKcal) * 100)}%` : '0%'}
        </span>
      </div>

      {/* Meal cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {mealsByType.map(({ key, label, emoji, color, meals, count }) => (
          <div
            key={key}
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderRadius: '1rem', padding: '0.875rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary, #1C1C1E)' }}>{label}</span>
              <span style={{ fontSize: '1rem' }}>{emoji}</span>
            </div>
            {count > 0 ? (
              <>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
                  {count} pasto{count > 1 ? 'i' : ''} registrat{count > 1 ? 'i' : 'o'}
                </p>
                {meals[0]?.notes && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.6875rem', color: 'var(--color-text-secondary, #8E8E93)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {meals[0].notes}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
                Nessun pasto
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Macro rings */}
      <div style={{
        backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem',
        padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <p style={{ margin: '0 0 0.875rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Oggi
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <MacroRing value={kcalLogged} max={dailyKcal} color="#FF9F0A" label="Kcal" unit="kcal" />
          <MacroRing value={proteinG} max={Math.round(dailyKcal * 0.25 / 4)} color="#007AFF" label="Proteine" unit="g" />
          <MacroRing value={carbsG} max={Math.round(dailyKcal * 0.5 / 4)} color="#34C759" label="Carbo" unit="g" />
          <MacroRing value={fatG} max={Math.round(dailyKcal * 0.25 / 9)} color="#AF52DE" label="Grassi" unit="g" />
        </div>
      </div>

      {/* Add meal */}
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            padding: '0.875rem', borderRadius: '1rem',
            border: '1.5px dashed var(--color-separator, #E5E5EA)',
            backgroundColor: 'transparent', color: '#AF52DE',
            fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Aggiungi pasto
        </button>
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <select
            value={addForm.mealType}
            onChange={(e) => setAddForm((f) => ({ ...f, mealType: e.target.value }))}
            style={inputStyle}
          >
            {MEAL_TYPES.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <textarea
            value={addForm.notes}
            onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Descrivi cosa hai mangiato…"
            rows={3}
            style={{ ...inputStyle, resize: 'none', marginTop: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setAdding(false)} style={{ ...btnStyle, backgroundColor: 'var(--color-bg, #F2F2F7)', color: 'var(--color-text-primary, #1C1C1E)', flex: 1 }}>
              Annulla
            </button>
            <button type="button" onClick={addMeal} disabled={addSaving || !addForm.notes.trim()} style={{ ...btnStyle, backgroundColor: '#AF52DE', color: '#fff', flex: 2 }}>
              {addSaving ? 'Salvataggio…' : 'Salva pasto'}
            </button>
          </div>
        </div>
      )}

      {/* Weekly summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <StatMini label="Pasti (7gg)" value={String(stats.mealsLogged7d)} color="#AF52DE" />
        <StatMini label="Obiettivo kcal" value={`${dailyKcal} kcal`} color="#FF9F0A" />
      </div>
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color }}>{value}</p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.625rem',
  border: '1px solid var(--color-separator, #E5E5EA)', backgroundColor: 'var(--color-bg, #F2F2F7)',
  fontSize: '0.9375rem', color: 'var(--color-text-primary, #1C1C1E)', outline: 'none', boxSizing: 'border-box',
}
const btnStyle: React.CSSProperties = {
  padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
  fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
}
