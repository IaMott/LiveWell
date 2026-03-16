'use client'

import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

function MoodBar({
  label,
  value,
  max = 10,
  color,
}: {
  label: string
  value: number | null
  max?: number
  color: string
}) {
  const pct = value != null ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>
          {value != null ? `${Math.round(value * 10) / 10}/10` : '—'}
        </span>
      </div>
      <div
        style={{
          height: '6px',
          borderRadius: '3px',
          backgroundColor: 'var(--color-bg, #F2F2F7)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: '3px',
            backgroundColor: color,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}

function DualLineChart({
  entries,
}: {
  entries: { mood: number | null; stress: number | null; createdAt: Date }[]
}) {
  const filtered = entries.filter((e) => e.mood != null || e.stress != null).slice(-7)
  if (filtered.length < 2) return null

  const W = 200
  const H = 50
  const n = filtered.length

  const moodPoints = filtered
    .map((e, i) => {
      if (e.mood == null) return null
      const x = (i / (n - 1)) * W
      const y = H - (e.mood / 10) * (H - 4) - 2
      return `${x},${y}`
    })
    .filter(Boolean) as string[]

  const stressPoints = filtered
    .map((e, i) => {
      if (e.stress == null) return null
      const x = (i / (n - 1)) * W
      const y = H - (e.stress / 10) * (H - 4) - 2
      return `${x},${y}`
    })
    .filter(Boolean) as string[]

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.375rem' }}>
        <span
          style={{
            fontSize: '0.625rem',
            color: '#5AC8FA',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '2px',
              backgroundColor: '#5AC8FA',
              borderRadius: '1px',
            }}
          />
          Umore
        </span>
        <span
          style={{
            fontSize: '0.625rem',
            color: '#AF52DE',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '2px',
              backgroundColor: '#AF52DE',
              borderRadius: '1px',
            }}
          />
          Stress
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '50px', overflow: 'visible' }}>
        {moodPoints.length >= 2 && (
          <polyline
            points={moodPoints.join(' ')}
            fill="none"
            stroke="#5AC8FA"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {stressPoints.length >= 2 && (
          <polyline
            points={stressPoints.join(' ')}
            fill="none"
            stroke="#AF52DE"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="4 2"
          />
        )}
        {filtered.map((e, i) => {
          const x = (i / (n - 1)) * W
          return (
            <g key={i}>
              {e.mood != null && (
                <circle cx={x} cy={H - (e.mood / 10) * (H - 4) - 2} r="2.5" fill="#5AC8FA" />
              )}
              {e.stress != null && (
                <circle cx={x} cy={H - (e.stress / 10) * (H - 4) - 2} r="2.5" fill="#AF52DE" />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function AttrRow({ label, value, unit }: { label: string; value: unknown; unit?: string | null }) {
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
          color: 'var(--color-text-primary, #1C1C1E)',
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

export function MindfulnessSection({ data }: Props) {
  const { stats, recentMindfulness, attributesByDomain } = data

  const avgMood = stats.avgMood7d
  const avgStress = stats.avgStress7d

  const mindAttrs = attributesByDomain?.['mindfulness'] ?? {}
  const mentalAttrs = attributesByDomain?.['mental'] ?? {}
  const allMindAttrs = { ...mentalAttrs, ...mindAttrs }

  const mindCartella = [
    { label: 'Ore di sonno', key: 'sleep_hours', unit: 'h' },
    { label: 'Latenza addormentamento', key: 'sleep_latency', unit: 'min' },
    { label: 'Risvegli notturni', key: 'night_wakings' },
    { label: 'Qualità del sonno', key: 'sleep_quality' },
    { label: 'Livello di stress', key: 'stress_level' },
    { label: 'Contesto relazionale', key: 'relational_context' },
    { label: 'Contesto lavorativo', key: 'work_context' },
    { label: 'Intensità distress', key: 'distress_intensity' },
  ]
  const hasMindData = mindCartella.some((item) => allMindAttrs[item.key]?.value != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-text-primary, #1C1C1E)',
          }}
        >
          Benessere Mentale
        </h2>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#5AC8FA',
            backgroundColor: 'rgba(90,200,250,0.1)',
            borderRadius: '999px',
            padding: '0.2rem 0.625rem',
          }}
        >
          {recentMindfulness.length > 0
            ? `${recentMindfulness.length} sessioni`
            : 'Nessuna sessione'}
        </span>
      </div>

      {/* Mood stats */}
      {(avgMood != null || recentMindfulness.length > 0) && (
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
              margin: '0 0 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #8E8E93)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Media 7 giorni
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <MoodBar label="Umore" value={avgMood} color="#5AC8FA" />
            <MoodBar
              label="Stress (inv.)"
              value={avgStress != null ? 10 - avgStress : null}
              color="#AF52DE"
            />
          </div>
        </div>
      )}

      {/* Dual trend chart */}
      {recentMindfulness.length >= 2 && (
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
            Trend umore e stress
          </p>
          <DualLineChart entries={recentMindfulness} />
        </div>
      )}

      {/* Dati Raccolti (agent-collected) */}
      <h3 style={sectionHeaderStyle}>Dati Raccolti</h3>
      {hasMindData ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '0 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {mindCartella.map(({ label, key, unit }, i) => (
            <div
              key={key}
              style={{
                borderBottom:
                  i < mindCartella.length - 1
                    ? '1px solid var(--color-separator, #E5E5EA)'
                    : 'none',
              }}
            >
              <AttrRow
                label={label}
                value={allMindAttrs[key]?.value}
                unit={unit ?? (allMindAttrs[key]?.unit as string | null | undefined)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(90,200,250,0.06)',
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
            Parla con lo psicologo per raccogliere i tuoi dati: qualità del sonno, livello di
            stress, contesto emotivo e molto altro.
          </p>
        </div>
      )}

      {/* Recent entries */}
      {recentMindfulness.length > 0 && (
        <>
          <h3 style={sectionHeaderStyle}>Sessioni recenti</h3>
          {recentMindfulness.slice(0, 3).map((e) => (
            <div
              key={e.id}
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
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary, #8E8E93)',
                  }}
                >
                  {new Date(e.createdAt).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                {e.content && (
                  <p
                    style={{
                      margin: '0.125rem 0 0',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary, #1C1C1E)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical' as const,
                    }}
                  >
                    {e.content}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#5AC8FA' }}>
                  😊 {e.mood}/10
                </p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#AF52DE' }}>
                  stress {e.stress}/10
                </p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Bottom stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {[
          { label: 'Sessioni 7gg', value: String(recentMindfulness.length), color: '#5AC8FA' },
          {
            label: 'Umore medio',
            value: avgMood != null ? `${Math.round(avgMood * 10) / 10}/10` : '—',
            color: '#34C759',
          },
          {
            label: 'Stress medio',
            value: avgStress != null ? `${Math.round(avgStress * 10) / 10}/10` : '—',
            color: '#AF52DE',
          },
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
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color }}>{value}</p>
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
