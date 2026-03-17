'use client'

import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

function SparklineChart({
  points,
  color,
}: {
  points: { value: number; recordedAt: Date }[]
  color: string
}) {
  if (points.length < 2) return null
  const W = 200
  const H = 40
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - ((p.value - min) / range) * (H - 4) - 2
    return `${x},${y}`
  })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '40px', overflow: 'visible' }}>
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => {
          const x = (i / (points.length - 1)) * W
          const y = H - ((p.value - min) / range) * (H - 4) - 2
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
        <span style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
          min {min}
        </span>
        <span style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
          max {max}
        </span>
      </div>
    </div>
  )
}

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
          color: alert && display !== '—' ? '#FF3B30' : 'var(--color-text-primary, #1C1C1E)',
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

export function HealthSection({ data }: Props) {
  const { profile, stats, attributesByDomain, bodyMetrics30d } = data

  const healthProfile = profile?.health as Record<string, unknown> | null
  const healthAttrs = attributesByDomain?.['health'] ?? {}
  const personalAttrs = attributesByDomain?.['personal'] ?? {}

  const lastWeight = stats.lastWeightEntry

  // Resolve height from profile or personal attrs
  const heightFromAttrs = personalAttrs['height']?.value
  const mergedHeight =
    profile?.height ?? (typeof heightFromAttrs === 'number' ? heightFromAttrs : null)

  // Cartella clinica (agent-collected health attributes)
  const clinicaCartella = [
    { label: 'Pressione arteriosa', key: 'blood_pressure', alert: false },
    { label: 'Condizioni / Patologie', key: 'conditions', alert: true },
    { label: 'Farmaci assunti', key: 'medications', alert: false },
    { label: 'Sintomi segnalati', key: 'symptoms', alert: true },
    { label: 'Allergie / Intolleranze', key: 'allergy', alert: true },
    { label: 'Diagnosi', key: 'diagnosis', alert: false },
    { label: 'Stile di vita', key: 'lifestyle', alert: false },
    { label: 'Esami recenti', key: 'recent_exams', alert: false },
    { label: 'Esami ormonali', key: 'hormonal_exams', alert: false },
  ]
  const hasClinicaData = clinicaCartella.some((item) => healthAttrs[item.key]?.value != null)

  // Manual profile fields (read-only display)
  const manualFields = [
    { label: 'Patologie', value: healthProfile?.conditions as string | null },
    { label: 'Farmaci', value: healthProfile?.medications as string | null },
    { label: 'Allergie', value: healthProfile?.allergies as string | null },
    { label: 'Fumo', value: healthProfile?.smokingStatus as string | null },
  ]
  const hasManualData = manualFields.some((f) => f.value)

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
          {lastWeight ? (
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
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: '0.6875rem',
                color: 'var(--color-text-secondary, #8E8E93)',
              }}
            >
              Comunicalo in chat
            </p>
          )}
        </div>

        {/* BMI card */}
        <div style={vitalCardStyle('#5AC8FA')}>
          <p style={vitalLabelStyle}>BMI</p>
          {/* C4: guard against division by zero when mergedHeight is 0 or falsy */}
          {mergedHeight && Number(mergedHeight) > 0 && lastWeight ? (
            <>
              <p style={{ ...vitalValueStyle, color: '#5AC8FA' }}>
                {(lastWeight.value / Math.pow(Number(mergedHeight) / 100, 2)).toFixed(1)}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-secondary, #8E8E93)',
                }}
              >
                {getBmiLabel(lastWeight.value / Math.pow(Number(mergedHeight) / 100, 2))}
              </p>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary, #8E8E93)',
                lineHeight: 1.4,
              }}
            >
              {!mergedHeight && !lastWeight
                ? 'Comunicami peso e altezza in chat'
                : !mergedHeight
                  ? "Comunicami l'altezza in chat"
                  : 'Comunicami il peso in chat'}
            </p>
          )}
        </div>
      </div>

      {/* Weight sparkline chart */}
      {bodyMetrics30d && bodyMetrics30d.length >= 2 && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              margin: '0 0 0.625rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #8E8E93)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Andamento peso — 30 giorni
          </p>
          <SparklineChart points={bodyMetrics30d} color="#34C759" />
        </div>
      )}

      {/* Cartella Clinica (agent-collected) */}
      <h3 style={sectionHeaderStyle}>Cartella Clinica</h3>
      {hasClinicaData ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '0 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {clinicaCartella.map(({ label, key, alert }, i) => (
            <div
              key={key}
              style={{
                borderBottom:
                  i < clinicaCartella.length - 1
                    ? '1px solid var(--color-separator, #E5E5EA)'
                    : 'none',
              }}
            >
              <AttrRow
                label={label}
                value={healthAttrs[key]?.value}
                unit={healthAttrs[key]?.unit as string | null | undefined}
                alert={alert}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(52,199,89,0.06)',
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
            💬 Inizia una chat
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            Parla con il medico per costruire la tua cartella clinica: patologie, farmaci, allergie,
            esami e stile di vita.
          </p>
        </div>
      )}

      {/* Manual health profile — read-only, show only if has data */}
      {hasManualData && (
        <>
          <h3 style={sectionHeaderStyle}>Profilo Clinico</h3>
          <div
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderRadius: '1rem',
              padding: '0 1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {manualFields.map(({ label, value }, i) => (
              <div key={label}>
                {i > 0 && (
                  <div
                    style={{ height: '1px', backgroundColor: 'var(--color-separator, #E5E5EA)' }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                    }}
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
        </>
      )}
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
