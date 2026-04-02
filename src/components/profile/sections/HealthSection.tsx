import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const KEY_LABELS: Record<string, string> = {
  weight: 'Peso',
  height: 'Altezza',
  gender: 'Sesso',
  age: 'Età',
  birthDate: 'Data di nascita',
  smokingStatus: 'Stato fumatore',
  blood_pressure: 'Pressione',
  symptoms: 'Sintomi',
  diagnosis: 'Diagnosi',
  medications: 'Farmaci',
  complaint: 'Motivo consulto',
  restingHr: 'Freq. cardiaca a riposo',
  hypertension: 'Ipertensione',
  allergy: 'Allergie',
  conditions: 'Patologie',
  lifestyle: 'Stile di vita',
  recent_exams: 'Esami recenti',
  hormonal_exams: 'Esami ormonali',
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

function dedupAssessments(
  events: NonNullable<ProfileData['clinicalEvents']>,
): NonNullable<ProfileData['clinicalEvents']> {
  const seen = new Map<string, NonNullable<ProfileData['clinicalEvents']>[0]>()
  for (const ev of events) {
    const raw = ev.title ?? ''
    const summary = raw.includes(' — ') ? raw.slice(raw.indexOf(' — ') + 3) : raw
    const key = `${ev.agentId ?? ''}::${summary.slice(0, 60).toLowerCase().trim()}`
    const existing = seen.get(key)
    const evTime = new Date((ev.eventDate ?? ev.createdAt) as Date).getTime()
    const exTime = existing
      ? new Date((existing.eventDate ?? existing.createdAt) as Date).getTime()
      : 0
    if (!existing || evTime > exTime) seen.set(key, ev)
  }
  return Array.from(seen.values()).sort(
    (a, b) =>
      new Date((b.eventDate ?? b.createdAt) as Date).getTime() -
      new Date((a.eventDate ?? a.createdAt) as Date).getTime(),
  )
}

export function HealthSection({ data }: Props) {
  const { attributesByDomainHistory, clinicalEvents } = data
  const history = attributesByDomainHistory ?? {}

  // Health section shows health + personal domains
  const domains: Array<{ key: string; label: string }> = [
    { key: 'personal', label: 'Dati Personali' },
    { key: 'health', label: 'Salute' },
  ]

  const hasAnyData = domains.some(({ key }) => Object.keys(history[key] ?? {}).length > 0)

  const assessments = dedupAssessments(
    (clinicalEvents ?? []).filter(
      (e) => e.eventType === 'agent_assessment' && e.domain === 'health',
    ),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {!hasAnyData && assessments.length === 0 ? (
        <p style={emptyStyle}>Nessun dato — parla con il team in chat.</p>
      ) : (
        <>
          {domains.map(({ key, label }) => {
            const entries = Object.entries(history[key] ?? {})
            if (entries.length === 0) return null
            return (
              <div key={key}>
                <p style={sectionLabel}>{label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem' }}>
                  {entries.map(([attrKey, attrHistory]) => {
                    const latest = attrHistory[0]
                    if (!latest) return null
                    return (
                      <div key={attrKey} style={rowStyle}>
                        <span style={fieldLabel}>{keyLabel(attrKey)}</span>
                        <span style={valueStyle}>
                          {formatVal(latest.value, latest.unit)}
                          <span style={dateStyle}> — {formatDateTime(latest.recordedAt)}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {assessments.length > 0 && (
            <div>
              <p style={sectionLabel}>Valutazioni</p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                }}
              >
                {assessments.map((ev) => {
                  const meta =
                    ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
                      ? (ev.metadata as Record<string, unknown>)
                      : {}
                  const displayName =
                    typeof meta.displayName === 'string' ? meta.displayName : (ev.agentId ?? '—')
                  const confidence =
                    typeof meta.confidence === 'number'
                      ? `${Math.round((meta.confidence as number) * 100)}%`
                      : null
                  const raw = ev.title ?? ''
                  const summaryPart = raw.includes(' — ') ? raw.slice(raw.indexOf(' — ') + 3) : raw
                  return (
                    <div key={ev.id} style={assessmentRowStyle}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.375rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          marginBottom: '0.125rem',
                        }}
                      >
                        <span style={assessmentNameStyle}>{displayName}</span>
                        {confidence && <span style={assessmentConfStyle}>{confidence}</span>}
                        <span style={dateStyle}>
                          {formatDateTime(ev.eventDate ?? ev.createdAt)}
                        </span>
                      </div>
                      <p style={assessmentTextStyle}>{summaryPart}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
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
const assessmentRowStyle: React.CSSProperties = {
  padding: '0.375rem 0',
  borderBottom: '1px solid var(--color-separator, #F2F2F7)',
}
const assessmentNameStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-primary, #1C1C1E)',
}
const assessmentConfStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary, #8E8E93)',
}
const assessmentTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  color: 'var(--color-text-primary, #1C1C1E)',
  lineHeight: 1.4,
}
const emptyStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
