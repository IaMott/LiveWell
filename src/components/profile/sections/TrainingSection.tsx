'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function TrainingSection({ data }: Props) {
  const { stats, recentWorkouts, profile } = data
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const trainingProfile = profile?.training as Record<string, unknown> | null
  const [form, setForm] = useState({
    weeklyDays: trainingProfile?.weeklyDays != null ? String(trainingProfile.weeklyDays) : '',
    fitnessLevel: trainingProfile?.fitnessLevel != null ? String(trainingProfile.fitnessLevel) : '',
    preferredActivities: trainingProfile?.preferredActivities != null ? String(trainingProfile.preferredActivities) : '',
    trainingGoal: trainingProfile?.trainingGoal != null ? String(trainingProfile.trainingGoal) : '',
  })
  const [addForm, setAddForm] = useState({ durationMin: '30', perceivedEffort: '6', notes: '' })

  async function saveProfile() {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'training',
          data: {
            weeklyDays: form.weeklyDays ? Number(form.weeklyDays) : undefined,
            fitnessLevel: form.fitnessLevel || undefined,
            preferredActivities: form.preferredActivities || undefined,
            trainingGoal: form.trainingGoal || undefined,
          },
        }),
      })
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function addWorkout() {
    setAddSaving(true)
    try {
      await fetch('/api/trackers/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMin: Number(addForm.durationMin) || 30,
          perceivedEffort: Number(addForm.perceivedEffort) || undefined,
          notes: addForm.notes || undefined,
        }),
      })
      setAdding(false)
      setAddForm({ durationMin: '30', perceivedEffort: '6', notes: '' })
      router.refresh()
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Profile edit card */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={sectionTitleStyle}>Allenamento</h2>
          <button onClick={() => setEditing((v) => !v)} style={editButtonStyle}>
            <Pencil size={12} />
            {editing ? 'Annulla' : 'Modifica'}
          </button>
        </div>
        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Row label="Livello" value={trainingProfile?.fitnessLevel ? String(trainingProfile.fitnessLevel) : '—'} />
            <Row label="Giorni/settimana" value={trainingProfile?.weeklyDays != null ? String(trainingProfile.weeklyDays) : '—'} />
            <Row label="Attività" value={trainingProfile?.preferredActivities ? String(trainingProfile.preferredActivities) : '—'} />
            <Row label="Obiettivo" value={trainingProfile?.trainingGoal ? String(trainingProfile.trainingGoal) : '—'} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="Livello di fitness">
              <select value={form.fitnessLevel} onChange={(e) => setForm((f) => ({ ...f, fitnessLevel: e.target.value }))} style={inputStyle}>
                <option value="">Seleziona</option>
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzato">Avanzato</option>
                <option value="atleta">Atleta</option>
              </select>
            </Field>
            <Field label="Giorni a settimana">
              <input type="number" value={form.weeklyDays} onChange={(e) => setForm((f) => ({ ...f, weeklyDays: e.target.value }))} placeholder="3" min={0} max={7} style={inputStyle} />
            </Field>
            <Field label="Attività preferite">
              <input value={form.preferredActivities} onChange={(e) => setForm((f) => ({ ...f, preferredActivities: e.target.value }))} placeholder="es: corsa, yoga, nuoto" style={inputStyle} />
            </Field>
            <Field label="Obiettivo">
              <select value={form.trainingGoal} onChange={(e) => setForm((f) => ({ ...f, trainingGoal: e.target.value }))} style={inputStyle}>
                <option value="">Seleziona</option>
                <option value="dimagrimento">Dimagrimento</option>
                <option value="massa-muscolare">Massa muscolare</option>
                <option value="resistenza">Resistenza / endurance</option>
                <option value="mobilita">Mobilità e flessibilità</option>
                <option value="salute-generale">Salute generale</option>
                <option value="performance">Performance sportiva</option>
              </select>
            </Field>
            <button onClick={saveProfile} disabled={saving} style={{ ...saveButtonStyle, backgroundColor: '#007AFF' }}>
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        <StatCard label="Sessioni (7gg)" value={stats.workoutSessions7d} color="#007AFF" />
        <StatCard label="Minuti totali" value={stats.totalWorkoutMin7d} unit="min" color="#007AFF" />
      </div>

      {/* Quick-add workout */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={sectionTitleStyle}>Ultime sessioni</h2>
          <button onClick={() => setAdding((v) => !v)} style={addButtonStyle}>
            <Plus size={13} />
            {adding ? 'Annulla' : 'Aggiungi'}
          </button>
        </div>

        {adding && (
          <div style={{ ...panelStyle, marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Field label="Durata (minuti)">
                  <input type="number" value={addForm.durationMin} onChange={(e) => setAddForm((f) => ({ ...f, durationMin: e.target.value }))} min={1} max={600} style={inputStyle} />
                </Field>
                <Field label="Sforzo percepito (1-10)">
                  <input type="number" value={addForm.perceivedEffort} onChange={(e) => setAddForm((f) => ({ ...f, perceivedEffort: e.target.value }))} min={1} max={10} style={inputStyle} />
                </Field>
              </div>
              <Field label="Note (opzionale)">
                <input value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} placeholder="es: corsa in salita, palestra upper body" style={inputStyle} />
              </Field>
              <button onClick={addWorkout} disabled={addSaving} style={{ ...saveButtonStyle, backgroundColor: '#007AFF' }}>
                {addSaving ? 'Salvataggio…' : 'Registra sessione'}
              </button>
            </div>
          </div>
        )}

        {recentWorkouts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentWorkouts.map((w) => (
              <div key={w.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {w.durationMin} min
                    {w.perceivedEffort != null && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>RPE {w.perceivedEffort}/10</span>}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {new Date(w.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {w.notes && <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{w.notes}</p>}
              </div>
            ))}
          </div>
        ) : !adding ? (
          <EmptyState message="Nessuna sessione registrata questa settimana. Il tuo personal trainer ti aiuterà a strutturare il piano." cta="Parla con il trainer" />
        ) : null}
      </div>
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
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{label}</label>
      {children}
    </div>
  )
}

const panelStyle: React.CSSProperties = { backgroundColor: 'var(--color-surface)', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const editButtonStyle: React.CSSProperties = { padding: '0.25rem 0.625rem', borderRadius: '999px', border: '1px solid var(--color-separator)', background: 'transparent', color: 'var(--color-accent)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }
const addButtonStyle: React.CSSProperties = { ...editButtonStyle, color: '#007AFF', borderColor: '#007AFF30' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1px solid var(--color-separator)', backgroundColor: 'var(--color-bg)', fontSize: '0.9375rem', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }
const saveButtonStyle: React.CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', color: '#fff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.25rem' }
const cardStyle: React.CSSProperties = { backgroundColor: 'var(--color-surface)', borderRadius: '1rem', padding: '0.875rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
