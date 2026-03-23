import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const KEY_LABELS: Record<string, string> = {
  training_frequency_per_week: 'Allenamenti/settimana',
  fitness_level: 'Livello fitness',
  sport: 'Sport',
  injury: 'Infortuni',
  goal: 'Obiettivo',
  training_goal: 'Obiettivo allenamento',
  equipment: 'Attrezzatura',
}

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key.replace(/_/g, ' ')
}

function formatVal(value: unknown, unit: string | null): string {
  if (value === null || value === undefined) return '—'
  return unit ? `${value} ${unit}` : String(value)
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TrainingSection({ data }: Props) {
  const { attributesByDomainHistory } = data
  const history = attributesByDomainHistory ?? {}
  const entries = Object.entries(history['training'] ?? {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <p style={titleStyle}>Allenamento</p>

      {entries.length === 0 ? (
        <p style={emptyStyle}>Nessun dato — parla con il team in chat.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map(([key, attrHistory]) => {
            const latest = attrHistory[0]
            if (!latest) return null
            return (
              <div key={key} style={rowStyle}>
                <span style={fieldLabel}>{keyLabel(key)}</span>
                <span style={valueStyle}>
                  {formatVal(latest.value, latest.unit)}
                  <span style={dateStyle}> — {formatDateTime(latest.recordedAt)}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}
const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '0.3rem 0',
  borderBottom: '1px solid var(--color-separator, #F2F2F7)',
  gap: '1rem',
}
const fieldLabel: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--color-text-secondary, #8E8E93)',
  flexShrink: 0,
}
const valueStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--color-text-primary, #1C1C1E)',
  textAlign: 'right',
}
const dateStyle: React.CSSProperties = {
  fontWeight: 400,
  color: 'var(--color-text-secondary, #8E8E93)',
  fontSize: '0.75rem',
}
const emptyStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
