import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type ClinicalEvent = ProfileData['clinicalEvents'][number]

type Props = { data: ProfileData }

// ── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  diagnosis: { label: 'Diagnosi', color: '#FF3B30', emoji: '🩺' },
  medication: { label: 'Farmaco', color: '#FF9F0A', emoji: '💊' },
  symptom: { label: 'Sintomo', color: '#FF6B35', emoji: '🌡️' },
  bloodwork: { label: 'Esame del sangue', color: '#5AC8FA', emoji: '🧪' },
  visit: { label: 'Visita', color: '#34C759', emoji: '🏥' },
  exam: { label: 'Esame', color: '#AF52DE', emoji: '📋' },
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Attivo',
  resolved: 'Risolto',
  ongoing: 'In corso',
  stopped: 'Interrotto',
}

const SEVERITY_COLOR: Record<string, string> = {
  low: '#34C759',
  medium: '#FF9F0A',
  high: '#FF3B30',
}

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CompletenessBar({
  domain,
  label,
  pct,
  color,
}: {
  domain: string
  label: string
  pct: number
  color: string
}) {
  return (
    <div key={domain} style={{ marginBottom: '0.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.25rem',
        }}
      >
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div
        style={{
          height: '6px',
          backgroundColor: 'var(--color-separator, #E5E5EA)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: '3px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}

function EventCard({ event }: { event: ClinicalEvent }) {
  const config = EVENT_CONFIG[event.eventType] ?? {
    label: event.eventType,
    color: '#8E8E93',
    emoji: '📌',
  }
  const statusLabel = STATUS_LABEL[event.status] ?? event.status

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.875rem 0',
        borderBottom: '1px solid var(--color-separator, #E5E5EA)',
      }}
    >
      {/* Timeline dot + line */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '32px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: `${config.color}15`,
            border: `2px solid ${config.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
          }}
        >
          {config.emoji}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: config.color,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.125rem',
              }}
            >
              {config.label}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--color-text-primary, #1C1C1E)',
                lineHeight: 1.3,
              }}
            >
              {event.title}
            </p>
          </div>

          {/* Status badge */}
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.6875rem',
              fontWeight: 500,
              padding: '0.125rem 0.5rem',
              borderRadius: '999px',
              backgroundColor:
                event.status === 'active' || event.status === 'ongoing'
                  ? 'rgba(255,59,48,0.1)'
                  : 'rgba(142,142,147,0.1)',
              color:
                event.status === 'active' || event.status === 'ongoing' ? '#FF3B30' : '#8E8E93',
            }}
          >
            {statusLabel}
          </span>
        </div>

        {event.description && (
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            {event.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
          {/* Date */}
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
            📅 {formatDate(event.eventDate)}
          </span>

          {/* Severity */}
          {event.severity && (
            <span
              style={{
                fontSize: '0.75rem',
                color: SEVERITY_COLOR[event.severity] ?? '#8E8E93',
                fontWeight: 500,
              }}
            >
              ⚠ Severità:{' '}
              {event.severity === 'low' ? 'bassa' : event.severity === 'medium' ? 'media' : 'alta'}
            </span>
          )}

          {/* Valid until */}
          {event.validUntil && (
            <span style={{ fontSize: '0.75rem', color: '#8E8E93' }}>
              ⏱ Fino al {formatDate(event.validUntil)}
            </span>
          )}

          {/* Agent */}
          {event.agentId && (
            <span style={{ fontSize: '0.75rem', color: '#8E8E93' }}>👤 {event.agentId}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CartellaSection({ data }: Props) {
  const { clinicalEvents, attributesByDomain, profile, user } = data

  // Calcola completezza dai domini chiave
  const DOMAIN_COMPLETENESS = [
    {
      domain: 'health',
      label: 'Salute',
      keys: ['bloodPressure', 'restingHr', 'conditions', 'medications', 'allergies'],
      color: '#34C759',
    },
    {
      domain: 'nutrition',
      label: 'Nutrizione',
      keys: ['caloricGoal', 'dietType', 'mealsPerDay', 'intolerances'],
      color: '#AF52DE',
    },
    {
      domain: 'training',
      label: 'Allenamento',
      keys: ['weeklyFrequency', 'fitnessLevel', 'trainingGoal', 'injuries'],
      color: '#007AFF',
    },
    {
      domain: 'mindfulness',
      label: 'Mindfulness',
      keys: ['stressLevel', 'sleepHours', 'mainStressor'],
      color: '#5AC8FA',
    },
  ]

  const completeness = DOMAIN_COMPLETENESS.map(({ domain, label, keys, color }) => {
    const attrs = attributesByDomain?.[domain] ?? {}
    const filled = keys.filter((k) => attrs[k] !== undefined).length
    const pct = Math.round((filled / keys.length) * 100)
    return { domain, label, pct, color }
  })

  // Raggruppa eventi per tipo
  const eventsByType = clinicalEvents.reduce<Record<string, ClinicalEvent[]>>((acc, ev) => {
    if (!acc[ev.eventType]) acc[ev.eventType] = []
    acc[ev.eventType].push(ev)
    return acc
  }, {})

  const hasEvents = clinicalEvents.length > 0

  // Calcola età
  const age = profile?.birthDate
    ? Math.floor(
        (new Date().getTime() - new Date(profile.birthDate).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25),
      )
    : null

  // Iniziali per avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Intestazione utente ── */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #fff)',
          borderRadius: '1rem',
          padding: '1.25rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF3B30, #FF6B35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{initials}</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: '0 0 0.125rem',
              fontSize: '1.0625rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #1C1C1E)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.name ?? 'Utente'}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
            }}
          >
            {[
              age ? `${age} anni` : null,
              profile?.gender ?? null,
              profile?.height ? `${profile.height} cm` : null,
              profile?.weight ? `${profile.weight} kg` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Completa il tuo profilo in chat'}
          </p>
          {profile?.weight && profile?.height && (
            <p
              style={{
                margin: '0.125rem 0 0',
                fontSize: '0.75rem',
                color: '#007AFF',
                fontWeight: 600,
              }}
            >
              BMI {(profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)}
            </p>
          )}
        </div>
      </div>

      {/* ── Header informativo ── */}
      <div
        style={{
          backgroundColor: 'rgba(52,199,89,0.06)',
          borderRadius: '1rem',
          padding: '1rem',
          borderLeft: '3px solid #34C759',
        }}
      >
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 700 }}>
          📁 Cartella Clinica
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary, #8E8E93)',
            lineHeight: 1.4,
          }}
        >
          Qui trovi il riepilogo dei tuoi dati sanitari raccolti dal team. Viene aggiornata
          automaticamente durante le conversazioni.
        </p>
      </div>

      {/* ── Completezza cartella ── */}
      <h3 style={sectionHeaderStyle}>Completezza Cartella</h3>
      <div style={cardStyle}>
        {completeness.map(({ domain, label, pct, color }) => (
          <CompletenessBar key={domain} domain={domain} label={label} pct={pct} color={color} />
        ))}
        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary, #8E8E93)',
          }}
        >
          💬 Parla con il team in chat per completare la tua cartella
        </p>
      </div>

      {/* ── Statistiche eventi ── */}
      {hasEvents && (
        <>
          <h3 style={sectionHeaderStyle}>Riepilogo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
            {Object.entries(eventsByType).map(([type, events]) => {
              const config = EVENT_CONFIG[type] ?? { emoji: '📌', color: '#8E8E93', label: type }
              return (
                <div
                  key={type}
                  style={{
                    backgroundColor: 'var(--color-surface, #fff)',
                    borderRadius: '0.875rem',
                    padding: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    textAlign: 'center',
                    borderTop: `3px solid ${config.color}`,
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{config.emoji}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: config.color }}>
                    {events.length}
                  </div>
                  <div
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                      fontWeight: 500,
                    }}
                  >
                    {config.label}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Timeline eventi ── */}
      <h3 style={sectionHeaderStyle}>Timeline Clinica</h3>
      {hasEvents ? (
        <div style={{ ...cardStyle, padding: '0 1rem' }}>
          {clinicalEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
          {/* Rimuovi l'ultimo separator */}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '1.5rem 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontSize: '2rem' }}>🩺</p>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 600 }}>
            Nessun evento registrato
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            Parla con il medico, il dietologo o lo psichiatra: i dati clinici verranno salvati
            automaticamente nella cartella.
          </p>
        </div>
      )}
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

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface, #fff)',
  borderRadius: '1rem',
  padding: '0.5rem 1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
