'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const EXERCISES = [
  { key: 'respiro', label: 'Pausa Respiro', emoji: '🌬️', duration: '5 min', kcal: '5 cal-equiv.', color: '#5AC8FA', desc: 'Focalizzati sul respiro. Respira lentamente — ripeti 5 cicli.' },
  { key: 'camminata', label: 'Camminata Consapevole', emoji: '🚶', duration: '10 min', kcal: '30 cal-equiv.', color: '#34C759', desc: 'Senti ogni passo mentre cammini. Disabilita le notifiche.' },
  { key: 'gratitudine', label: 'Esercizio di Gratitudine', emoji: '🙏', duration: '3 min', kcal: '5 cal-equiv.', color: '#FF9F0A', desc: 'Scrivi 3 cose per cui sei grato oggi. Anche piccole cose contano.' },
  { key: 'visualizzazione', label: 'Visualizzazione', emoji: '✨', duration: '7 min', kcal: '8 cal-equiv.', color: '#AF52DE', desc: 'Immagina un luogo sereno. Usa tutti i sensi. Rilassa le spalle.' },
]

function MoodBar({ label, value, max = 10, color }: { label: string; value: number | null; max?: number; color: string }) {
  const pct = value != null ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)' }}>{label}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{value != null ? `${Math.round(value * 10) / 10}/10` : '—'}</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-bg, #F2F2F7)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', backgroundColor: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export function MindfulnessSection({ data }: Props) {
  const { stats, recentMindfulness } = data
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({ mood: '7', stress: '4', content: '' })

  const avgMood = stats.avgMood7d
  const avgStress = stats.avgStress7d

  async function addEntry() {
    setAddSaving(true)
    try {
      await fetch('/api/profile/mindfulness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: Number(addForm.mood), stress: Number(addForm.stress), content: addForm.content }),
      })
      setAdding(false)
      setAddForm({ mood: '7', stress: '4', content: '' })
      router.refresh()
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary, #1C1C1E)' }}>
          Consigli per il Giorno
        </h2>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#5AC8FA', backgroundColor: 'rgba(90,200,250,0.1)', borderRadius: '999px', padding: '0.2rem 0.625rem' }}>
          {recentMindfulness.length > 0 ? `${recentMindfulness.length} sessioni` : 'Inizia oggi'}
        </span>
      </div>

      {/* Exercise cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {EXERCISES.map(({ key, label, emoji, duration, kcal, color, desc }) => (
          <div
            key={key}
            style={{
              backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem',
              padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderTop: `3px solid ${color}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary, #1C1C1E)', lineHeight: 1.3 }}>{label}</span>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{emoji}</span>
            </div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.6875rem', color: 'var(--color-text-secondary, #8E8E93)', lineHeight: 1.4 }}>{desc}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6875rem', color, fontWeight: 600 }}>{duration}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary, #8E8E93)' }}>{kcal}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Mood stats */}
      {(avgMood != null || recentMindfulness.length > 0) && (
        <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Media 7 giorni
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <MoodBar label="Umore" value={avgMood} color="#5AC8FA" />
            <MoodBar label="Stress (inv.)" value={avgStress != null ? 10 - avgStress : null} color="#AF52DE" />
          </div>
        </div>
      )}

      {/* Recent entries */}
      {recentMindfulness.length > 0 && (
        <>
          <h3 style={sectionHeaderStyle}>Sessioni recenti</h3>
          {recentMindfulness.slice(0, 3).map((e) => (
            <div key={e.id} style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '0.875rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
                  {new Date(e.createdAt).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                {e.content && (
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-primary, #1C1C1E)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const }}>
                    {e.content}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#5AC8FA' }}>😊 {e.mood}/10</p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#AF52DE' }}>stress {e.stress}/10</p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add entry */}
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} style={{ padding: '0.875rem', borderRadius: '1rem', border: '1.5px dashed var(--color-separator, #E5E5EA)', backgroundColor: 'transparent', color: '#5AC8FA', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>
          + Registra stato d&apos;animo
        </button>
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Umore (1-10)</label>
              <input type="number" value={addForm.mood} min={1} max={10} onChange={(e) => setAddForm((f) => ({ ...f, mood: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Stress (1-10)</label>
              <input type="number" value={addForm.stress} min={1} max={10} onChange={(e) => setAddForm((f) => ({ ...f, stress: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <textarea value={addForm.content} onChange={(e) => setAddForm((f) => ({ ...f, content: e.target.value }))} placeholder="Come ti senti oggi? (opzionale)" rows={2} style={{ ...inputStyle, resize: 'none', marginTop: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setAdding(false)} style={{ ...btnStyle, backgroundColor: 'var(--color-bg, #F2F2F7)', color: 'var(--color-text-primary, #1C1C1E)', flex: 1 }}>Annulla</button>
            <button type="button" onClick={addEntry} disabled={addSaving} style={{ ...btnStyle, backgroundColor: '#5AC8FA', color: '#fff', flex: 2 }}>{addSaving ? 'Salvataggio…' : 'Salva'}</button>
          </div>
        </div>
      )}

      {/* Bottom stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {[
          { label: 'Sessioni 7gg', value: String(recentMindfulness.length), color: '#5AC8FA' },
          { label: 'Umore medio', value: avgMood != null ? `${(Math.round(avgMood * 10) / 10)}/10` : '—', color: '#34C759' },
          { label: 'Stress medio', value: avgStress != null ? `${(Math.round(avgStress * 10) / 10)}/10` : '—', color: '#AF52DE' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = { margin: '0.25rem 0 0', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1px solid var(--color-separator, #E5E5EA)', backgroundColor: 'var(--color-bg, #F2F2F7)', fontSize: '0.9375rem', color: 'var(--color-text-primary, #1C1C1E)', outline: 'none', boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', marginBottom: '0.25rem' }
