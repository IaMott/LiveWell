'use client'

import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import Link from 'next/link'
import type React from 'react'
import { useState } from 'react'

type Props = { data: ProfileData }

// C3: Map the actual DB enum values (toolRegistry: 'nutrition'|'training'|'mindfulness'|'other')
// to colors. Legacy values kept for backward compatibility with older artifact records.
const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  // DB-stored values (toolRegistry.ts enum)
  nutrition: '#34C759',
  training: '#007AFF',
  mindfulness: '#AF52DE',
  other: '#FF9F0A',
  // Legacy values (old artifact records pre-schema alignment)
  workout_plan: '#007AFF',
  meal_plan: '#34C759',
  recommendation: '#FF9F0A',
  article: '#5AC8FA',
  tip: '#AF52DE',
  report: '#FF3B30',
}

function getArtifactColor(type: string): string {
  return ARTIFACT_TYPE_COLORS[type] ?? '#FF9F0A'
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

export function IdeasSection({ data }: Props) {
  const { allArtifacts, attributesByDomain } = data
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // Use allArtifacts (up to 20) for full display
  const artifacts = allArtifacts ?? []

  // Unique artifact types for filter tabs
  const types = Array.from(new Set(artifacts.map((a) => a.type).filter(Boolean)))

  const filtered =
    activeFilter === 'all' ? artifacts : artifacts.filter((a) => a.type === activeFilter)

  // Cartella Professionale from career and financial domains.
  // normalizeDomain maps: life-organizer → career, commercialista → financial, inspiration → career.
  const careerAttrs = attributesByDomain?.['career'] ?? {}
  const financialAttrs = attributesByDomain?.['financial'] ?? {}
  // life-organizer and commercialista are now stored under career/financial respectively
  const lifeAttrs = careerAttrs
  const commAttrs = financialAttrs

  const professionalSections = [
    {
      title: 'Carriera',
      emoji: '💼',
      color: '#007AFF',
      items: [
        { label: 'Ruolo attuale', key: 'current_role', attrs: careerAttrs },
        { label: 'Obiettivo professionale', key: 'professional_goal', attrs: careerAttrs },
        { label: 'Settore', key: 'industry', attrs: careerAttrs },
      ],
    },
    {
      title: 'Finanze',
      emoji: '💰',
      color: '#34C759',
      items: [
        { label: 'Obiettivo finanziario', key: 'financial_goal', attrs: financialAttrs },
        { label: 'Tolleranza al rischio', key: 'risk_tolerance', attrs: financialAttrs },
        { label: 'Budget mensile', key: 'monthly_budget', attrs: financialAttrs },
      ],
    },
    {
      title: 'Organizzazione',
      emoji: '📋',
      color: '#FF9F0A',
      items: [
        { label: 'Obiettivo organizzativo', key: 'organizational_goal', attrs: lifeAttrs },
        { label: 'Priorità', key: 'priority', attrs: lifeAttrs },
      ],
    },
    {
      title: 'Fiscale',
      emoji: '📊',
      color: '#AF52DE',
      items: [
        { label: 'Tipo attività', key: 'activity_type', attrs: commAttrs },
        { label: 'Regime fiscale', key: 'tax_regime', attrs: commAttrs },
      ],
    },
  ]

  const hasProfessionalData = professionalSections.some((section) =>
    section.items.some((item) => item.attrs[item.key]?.value != null),
  )

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
          Raccomandazioni
        </h2>
        {artifacts.length > 0 && (
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#FF9F0A',
              backgroundColor: 'rgba(255,159,10,0.1)',
              borderRadius: '999px',
              padding: '0.2rem 0.625rem',
            }}
          >
            {artifacts.length} totali
          </span>
        )}
      </div>

      {/* Filter tabs */}
      {types.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '0.375rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '999px',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeFilter === 'all' ? '#FF9F0A' : 'var(--color-surface, #fff)',
              color: activeFilter === 'all' ? '#fff' : 'var(--color-text-secondary, #8E8E93)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            Tutti
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setActiveFilter(t)}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor:
                  activeFilter === t ? getArtifactColor(t) : 'var(--color-surface, #fff)',
                color: activeFilter === t ? '#fff' : 'var(--color-text-secondary, #8E8E93)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Artifacts list */}
      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map((a) => {
            const color = getArtifactColor(a.type)
            return (
              <div
                key={a.id}
                style={{
                  backgroundColor: 'var(--color-surface, #fff)',
                  borderRadius: '1rem',
                  padding: '1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.375rem',
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
                    {a.title}
                  </p>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                      flexShrink: 0,
                      marginLeft: '0.5rem',
                    }}
                  >
                    {new Date(a.createdAt).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.8125rem',
                    color,
                    fontWeight: 500,
                  }}
                >
                  {a.type.replace(/_/g, ' ')}
                </p>
                {a.contentMarkdown && (
                  <p
                    style={{
                      margin: '0.375rem 0 0',
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }}
                  >
                    {a.contentMarkdown.replace(/[#*`]/g, '').slice(0, 140)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(255,159,10,0.06)',
            borderRadius: '1rem',
            padding: '1.25rem 1rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 0.375rem',
              fontSize: '1.75rem',
            }}
          >
            💡
          </p>
          <p
            style={{
              margin: '0 0 0.375rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #1C1C1E)',
            }}
          >
            Nessuna raccomandazione ancora
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            Inizia una chat con il team per ricevere piani, idee e raccomandazioni personalizzate
            basate sui tuoi obiettivi.
          </p>
        </div>
      )}

      {/* Cartella Professionale */}
      <h3 style={sectionHeaderStyle}>Cartella Professionale</h3>
      {hasProfessionalData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {professionalSections.map(({ title, emoji, color, items }) => {
            const hasData = items.some((item) => item.attrs[item.key]?.value != null)
            if (!hasData) return null
            return (
              <div
                key={title}
                style={{
                  backgroundColor: 'var(--color-surface, #fff)',
                  borderRadius: '1rem',
                  padding: '0.875rem 1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  borderTop: `3px solid ${color}`,
                }}
              >
                <p
                  style={{
                    margin: '0 0 0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary, #1C1C1E)',
                  }}
                >
                  {emoji} {title}
                </p>
                <div style={{ padding: '0' }}>
                  {items.map(({ label, key, attrs }, i) => (
                    <div
                      key={key}
                      style={{
                        borderTop: i > 0 ? '1px solid var(--color-separator, #E5E5EA)' : 'none',
                      }}
                    >
                      <AttrRow
                        label={label}
                        value={attrs[key]?.value}
                        unit={attrs[key]?.unit as string | null | undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(255,159,10,0.06)',
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
            💬 Parla con i consulenti
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            Il team include career coach, financial planner e commercialista.{' '}
            {/* M9: added actionable link so user has a clear path forward */}
            <Link
              href="/chat"
              style={{ color: '#FF9F0A', textDecoration: 'none', fontWeight: 600 }}
            >
              Inizia una chat
            </Link>{' '}
            per costruire la tua cartella professionale.
          </p>
        </div>
      )}

      {/* Chat CTA */}
      {/* M9: Chat CTA with actionable link */}
      <Link href="/chat" style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            backgroundColor: 'rgba(255,159,10,0.08)',
            borderRadius: '1rem',
            padding: '1rem',
            cursor: 'pointer',
          }}
        >
          <p
            style={{
              margin: '0 0 0.375rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #1C1C1E)',
            }}
          >
            💬 Richiedi nuove idee
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            Scrivi nella chat per ricevere idee personalizzate basate sui tuoi obiettivi e
            interessi.
          </p>
        </div>
      </Link>

      {/* Bottom stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        {[
          { label: 'Raccomandazioni', value: String(artifacts.length), color: '#FF9F0A' },
          { label: 'Tipi', value: String(types.length || 0), color: '#AF52DE' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderRadius: '1rem',
              padding: '0.875rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <p
              style={{
                margin: '0 0 0.2rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary, #8E8E93)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {label}
            </p>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color }}>{value}</p>
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
