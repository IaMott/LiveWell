'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const WORKOUT_TYPES = [
  { key: 'cardio', label: 'Cardio', emoji: '🏃', color: '#FF3B30', desc: 'Corsa, bici, nuoto' },
  { key: 'forza', label: 'Forza', emoji: '🏋️', color: '#007AFF', desc: 'Pesi, macchine' },
  {
    key: 'flessibilita',
    label: 'Flessibilità',
    emoji: '🧘',
    color: '#34C759',
    desc: 'Yoga, stretching',
  },
  { key: 'sport', label: 'Sport', emoji: '⚽', color: '#FF9F0A', desc: 'Sport di squadra' },
]

function AttrRow({
  label,
  value,
  unit,
  alert,
}: {
  label: string
  value: unknown
  unit?: string | null
  alert?: boolean
}) {
  const display = value == null || value === '' ? '—' : String(value)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: alert && display !== '—' ? '#FF9F0A' : 'var(--color-text-primary, #1C1C1E)',
          maxWidth: '60%',
          textAlign: 'right',
        }}
      >
        {display}
        {unit && display !== '—' ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

export function TrainingSection({ data }: Props) {
  const { stats, recentWorkouts, profile, attributesByDomain, workoutPlan } = data
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({
    type: 'cardio',
    durationMin: '30',
    effort: '6',
    notes: '',
  })

  const trainAttrs = attributesByDomain?.['training'] ?? {}
  const sportAttrs = attributesByDomain?.['sport'] ?? {}

  // Weekly target: prefer agent-collected attr, then profile, then 3
  const trainingProfile = profile?.training as Record<string, unknown> | null
  const attrFreq = trainAttrs['training_frequency_per_week']?.value
  const weeklyTarget =
    (typeof attrFreq === 'number' ? attrFreq : null) ??
    (trainingProfile?.weeklyDays != null ? Number(trainingProfile.weeklyDays) : 3)
  const progressPct = Math.min(
    100,
    weeklyTarget > 0 ? Math.round((stats.workoutSessions7d / weeklyTarget) * 100) : 0,
  )

  async function addWorkout() {
    setAddSaving(true)
    try {
      await fetch('/api/profile/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMin: Number(addForm.durationMin),
          perceivedEffort: Number(addForm.effort),
          notes: `${addForm.type}: ${addForm.notes}`.trim(),
        }),
      })
      setAdding(false)
      router.refresh()
    } finally {
      setAddSaving(false)
    }
  }

  // Cartella allenamento
  const trainCartella = [
    { label: 'Livello fitness', key: 'fitness_level', attrs: trainAttrs },
    {
      label: 'Frequenza settimanale',
      key: 'training_frequency_per_week',
      attrs: trainAttrs,
      unit: 'gg/sett',
    },
    { label: 'Sport praticati', key: 'sport', attrs: sportAttrs },
    { label: 'Attrezzatura', key: 'equipment', attrs: trainAttrs },
    { label: 'Infortuni / Limitazioni', key: 'injury', attrs: trainAttrs, alert: true },
    { label: 'Obiettivo allenamento', key: 'training_goal', attrs: trainAttrs },
  ]
  const hasTrainData = trainCartella.some((item) => item.attrs[item.key]?.value != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Weekly progress bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #fff)',
          borderRadius: '1rem',
          padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary, #1C1C1E)',
            }}
          >
            Obiettivo settimanale
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#007AFF' }}>
            {stats.workoutSessions7d}/{weeklyTarget} gg
          </span>
        </div>
        <div
          style={{
            height: '8px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-bg, #F2F2F7)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: '4px',
              backgroundColor: '#007AFF',
              transition: 'width 0.3s',
            }}
          />
        </div>
        <p
          style={{
            margin: '0.375rem 0 0',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary, #8E8E93)',
          }}
        >
          {stats.totalWorkoutMin7d > 0
            ? `${stats.totalWorkoutMin7d} min totali questa settimana`
            : 'Nessun allenamento questa settimana'}
        </p>
      </div>

      {/* Workout type cards */}
      <h3 style={sectionHeaderStyle}>Tipi di allenamento</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {WORKOUT_TYPES.map(({ key, label, emoji, color, desc }) => {
          const count = recentWorkouts.filter((w) => w.notes?.toLowerCase().includes(key)).length
          return (
            <div
              key={key}
              style={{
                backgroundColor: 'var(--color-surface, #fff)',
                borderRadius: '1rem',
                padding: '0.875rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                borderTop: `3px solid ${color}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.25rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary, #1C1C1E)',
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: '1.125rem' }}>{emoji}</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary, #8E8E93)',
                }}
              >
                {desc}
              </p>
              {count > 0 && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.6875rem', fontWeight: 600, color }}>
                  {count}× questa settimana
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Active workout plan */}
      {workoutPlan && (
        <>
          <h3 style={sectionHeaderStyle}>Piano di allenamento attivo</h3>
          <div
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderRadius: '1rem',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderLeft: '3px solid #007AFF',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary, #1C1C1E)',
                  flex: 1,
                }}
              >
                {workoutPlan.title ?? 'Piano personalizzato'}
              </p>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(0,122,255,0.1)',
                  color: '#007AFF',
                  flexShrink: 0,
                  marginLeft: '0.5rem',
                }}
              >
                {workoutPlan.weeklyDays ?? '—'} gg/sett
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary, #8E8E93)',
              }}
            >
              Creato{' '}
              {new Date(workoutPlan.createdAt).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'long',
              })}
            </p>
            {Array.isArray(workoutPlan.sessions) && workoutPlan.sessions.length > 0 && (
              <div
                style={{
                  marginTop: '0.625rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                {(workoutPlan.sessions as Array<{ name?: string; exercises?: unknown[] }>)
                  .slice(0, 3)
                  .map((s, i) => (
                    <p
                      key={i}
                      style={{
                        margin: 0,
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-primary, #1C1C1E)',
                      }}
                    >
                      {s.name ?? `Sessione ${i + 1}`}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Cartella Allenamento */}
      <h3 style={sectionHeaderStyle}>Cartella Allenamento</h3>
      {hasTrainData ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '0 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {trainCartella.map(({ label, key, attrs, alert, unit }, i) => (
            <div
              key={key}
              style={{
                borderBottom:
                  i < trainCartella.length - 1
                    ? '1px solid var(--color-separator, #E5E5EA)'
                    : 'none',
              }}
            >
              <AttrRow
                label={label}
                value={attrs[key]?.value}
                unit={unit ?? (attrs[key]?.unit as string | null | undefined)}
                alert={alert}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(0,122,255,0.06)',
            borderRadius: '1rem',
            padding: '1rem',
          }}
        >
          <p
            style={{
              margin: '0 0 0.25rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--color-text-primary, #1C1C1E)',
            }}
          >
            💬 Parla con il personal trainer
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            Inizia una chat per costruire la tua cartella allenamento: livello, obiettivi, infortuni
            e piano settimanale personalizzato.
          </p>
        </div>
      )}

      {/* Recent workouts */}
      {recentWorkouts.length > 0 && (
        <>
          <h3 style={sectionHeaderStyle}>Sessioni recenti</h3>
          {recentWorkouts.slice(0, 3).map((w) => (
            <div
              key={w.id}
              style={{
                backgroundColor: 'var(--color-surface, #fff)',
                borderRadius: '1rem',
                padding: '0.875rem 1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary, #1C1C1E)',
                  }}
                >
                  {w.notes ?? 'Sessione'}
                </p>
                <p
                  style={{
                    margin: '0.125rem 0 0',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary, #8E8E93)',
                  }}
                >
                  {new Date(w.date).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#007AFF' }}>
                  {w.durationMin ?? '—'} min
                </p>
                {w.perceivedEffort != null && (
                  <p
                    style={{
                      margin: '0.125rem 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                    }}
                  >
                    RPE {w.perceivedEffort}/10
                  </p>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add workout */}
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            padding: '0.875rem',
            borderRadius: '1rem',
            border: '1.5px dashed var(--color-separator, #E5E5EA)',
            backgroundColor: 'transparent',
            color: '#007AFF',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Aggiungi allenamento
        </button>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <select
            value={addForm.type}
            onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
            style={inputStyle}
          >
            {WORKOUT_TYPES.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              marginTop: '0.5rem',
            }}
          >
            <div>
              <label style={labelStyle}>Durata (min)</label>
              <input
                type="number"
                value={addForm.durationMin}
                min={5}
                max={300}
                onChange={(e) => setAddForm((f) => ({ ...f, durationMin: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Sforzo (1-10)</label>
              <input
                type="number"
                value={addForm.effort}
                min={1}
                max={10}
                onChange={(e) => setAddForm((f) => ({ ...f, effort: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <input
            value={addForm.notes}
            onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Note opzionali…"
            style={{ ...inputStyle, marginTop: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setAdding(false)}
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
              onClick={addWorkout}
              disabled={addSaving}
              style={{ ...btnStyle, backgroundColor: '#007AFF', color: '#fff', flex: 2 }}
            >
              {addSaving ? 'Salvataggio…' : 'Salva sessione'}
            </button>
          </div>
        </div>
      )}

      {/* Stats bottom bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {[
          { label: 'Sessioni 7gg', value: String(stats.workoutSessions7d), color: '#007AFF' },
          { label: 'Minuti attivi', value: String(stats.totalWorkoutMin7d), color: '#34C759' },
          { label: 'Obiettivo', value: `${weeklyTarget} gg/sett`, color: '#FF9F0A' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderRadius: '1rem',
              padding: '0.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: '0 0 0.2rem',
                fontSize: '0.625rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary, #8E8E93)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {label}
            </p>
            <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
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
