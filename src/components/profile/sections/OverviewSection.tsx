'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'

type Props = { data: ProfileData }

export function OverviewSection({ data }: Props) {
  const { stats, user, profile, artifacts } = data
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user.name ?? '',
    birthDate: profile?.birthDate ? String(profile.birthDate).slice(0, 10) : '',
    gender: profile?.gender ?? '',
    height: profile?.height != null ? String(profile.height) : '',
    weight: profile?.weight != null ? String(profile.weight) : '',
  })

  const age = form.birthDate
    ? Math.floor((Date.now() - new Date(form.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'personal',
          data: {
            name: form.name || undefined,
            birthDate: form.birthDate || undefined,
            gender: form.gender || undefined,
            height: form.height ? Number(form.height) : undefined,
            weight: form.weight ? Number(form.weight) : undefined,
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
      {/* Personal card */}
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
            Dati personali
          </h2>
          <button
            onClick={() => setEditing((v) => !v)}
            style={{
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
            }}
          >
            <Pencil size={12} />
            {editing ? 'Annulla' : 'Modifica'}
          </button>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Row label="Nome" value={user.name ?? '—'} />
            <Row label="Età" value={age != null ? `${age} anni` : '—'} />
            <Row label="Sesso" value={profile?.gender ?? '—'} />
            <Row
              label="Altezza"
              value={profile?.height != null ? `${profile.height} cm` : '—'}
            />
            <Row
              label="Peso"
              value={profile?.weight != null ? `${profile.weight} kg` : '—'}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="Nome">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Il tuo nome"
                style={inputStyle}
              />
            </Field>
            <Field label="Data di nascita">
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <Field label="Sesso">
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Seleziona</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
                <option value="altro">Altro</option>
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Field label="Altezza (cm)">
                <input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                  placeholder="175"
                  min={100}
                  max={250}
                  style={inputStyle}
                />
              </Field>
              <Field label="Peso (kg)">
                <input
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                  placeholder="70"
                  min={30}
                  max={300}
                  step={0.1}
                  style={inputStyle}
                />
              </Field>
            </div>
            <button
              onClick={save}
              disabled={saving}
              style={saveButtonStyle}
            >
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        <StatCard label="Conversazioni" value={stats.conversationCount} color="var(--color-accent)" />
        <StatCard label="Allenamenti (7gg)" value={stats.workoutSessions7d} color="#007AFF" />
        <StatCard label="Pasti (7gg)" value={stats.mealsLogged7d} color="#AF52DE" />
        {stats.avgMood7d != null && (
          <StatCard label="Umore medio" value={Math.round(stats.avgMood7d * 10) / 10} unit="/10" color="#5AC8FA" />
        )}
        {stats.lastWeightEntry && (
          <StatCard
            label="Ultimo peso"
            value={stats.lastWeightEntry.value}
            unit={stats.lastWeightEntry.unit}
            color="#34C759"
          />
        )}
      </div>

      {/* Recent AI artifacts */}
      {artifacts.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 0.5rem',
            }}
          >
            Raccomandazioni recenti
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {artifacts.slice(0, 3).map((a) => (
              <div
                key={a.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '1rem',
                  padding: '0.875rem 1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {a.title}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  {a.type} ·{' '}
                  {new Date(a.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </section>
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
      <label
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
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
  backgroundColor: 'var(--color-accent)',
  color: '#fff',
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '0.25rem',
}
