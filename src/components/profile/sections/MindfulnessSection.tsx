'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function MindfulnessSection({ data }: Props) {
  const { stats, recentMindfulness, profile } = data
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const mindfulnessProfile = profile?.mindfulness as Record<string, unknown> | null
  const [form, setForm] = useState({
    sleepHours: mindfulnessProfile?.sleepHours != null ? String(mindfulnessProfile.sleepHours) : '',
    stressTarget: mindfulnessProfile?.stressTarget != null ? String(mindfulnessProfile.stressTarget) : '',
    meditationGoal: mindfulnessProfile?.meditationGoal != null ? String(mindfulnessProfile.meditationGoal) : '',
    mainStressors: mindfulnessProfile?.mainStressors != null ? String(mindfulnessProfile.mainStressors) : '',
  })

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'mindfulness',
          data: {
            sleepHours: form.sleepHours ? Number(form.sleepHours) : undefined,
            stressTarget: form.stressTarget ? Number(form.stressTarget) : undefined,
            meditationGoal: form.meditationGoal || undefined,
            mainStressors: form.mainStressors || undefined,
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
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={labelStyle}>Mindfulness</h2>
          <button onClick={() => setEditing((v) => !v)} style={editButtonStyle}>
            <Pencil size={12} />
            {editing ? 'Annulla' : 'Modifica'}
          </button>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Row label="Ore di sonno target" value={mindfulnessProfile?.sleepHours != null ? `${mindfulnessProfile.sleepHours}h` : '—'} />
            <Row label="Obiettivo stress" value={mindfulnessProfile?.stressTarget != null ? `${mindfulnessProfile.stressTarget}/10` : '—'} />
            <Row label="Obiettivo meditazione" value={mindfulnessProfile?.meditationGoal ? String(mindfulnessProfile.meditationGoal) : '—'} />
            <Row label="Principali stressori" value={mindfulnessProfile?.mainStressors ? String(mindfulnessProfile.mainStressors) : '—'} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Field label="Ore di sonno target">
                <input
                  type="number"
                  value={form.sleepHours}
                  onChange={(e) => setForm((f) => ({ ...f, sleepHours: e.target.value }))}
                  placeholder="8"
                  min={4}
                  max={12}
                  step={0.5}
                  style={inputStyle}
                />
              </Field>
              <Field label="Livello stress target (1-10)">
                <input
                  type="number"
                  value={form.stressTarget}
                  onChange={(e) => setForm((f) => ({ ...f, stressTarget: e.target.value }))}
                  placeholder="3"
                  min={1}
                  max={10}
                  style={inputStyle}
                />
              </Field>
            </div>
            <Field label="Obiettivo meditazione">
              <select value={form.meditationGoal} onChange={(e) => setForm((f) => ({ ...f, meditationGoal: e.target.value }))} style={inputStyle}>
                <option value="">Seleziona</option>
                <option value="ridurre-stress">Ridurre lo stress</option>
                <option value="migliorare-sonno">Migliorare il sonno</option>
                <option value="focus">Aumentare la concentrazione</option>
                <option value="benessere-generale">Benessere generale</option>
                <option value="ansia">Gestire l&apos;ansia</option>
              </select>
            </Field>
            <Field label="Principali fonti di stress">
              <input
                value={form.mainStressors}
                onChange={(e) => setForm((f) => ({ ...f, mainStressors: e.target.value }))}
                placeholder="es: lavoro, relazioni, salute"
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
        {stats.avgMood7d != null && (
          <StatCard label="Umore medio (7gg)" value={Math.round(stats.avgMood7d * 10) / 10} unit="/10" color="#5AC8FA" />
        )}
        {stats.avgStress7d != null && (
          <StatCard label="Stress medio (7gg)" value={Math.round(stats.avgStress7d * 10) / 10} unit="/10" color="#FF9F0A" />
        )}
      </div>

      {recentMindfulness.length > 0 ? (
        <section>
          <h2 style={sectionTitleStyle}>Journal recente</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentMindfulness.map((entry) => (
              <div key={entry.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {entry.mood != null && (
                      <span style={{ fontSize: '0.8125rem', color: '#5AC8FA', fontWeight: 600 }}>
                        😊 {entry.mood}/10
                      </span>
                    )}
                    {entry.stress != null && (
                      <span style={{ fontSize: '0.8125rem', color: '#FF9F0A', fontWeight: 600 }}>
                        😤 {entry.stress}/10
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {new Date(entry.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {entry.content && (
                  <p style={{ margin: '0.375rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {entry.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          message="Nessun dato di benessere registrato. Il tuo mental coach ti aiuterà a monitorare umore e stress."
          cta="Parla con il mental coach"
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

const panelStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderRadius: '1rem',
  padding: '1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
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
  backgroundColor: '#5AC8FA',
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
