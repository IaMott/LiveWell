import type { ProfileData } from '@/app/(app)/profile/[domain]/page'

type Props = { data: ProfileData }

// ── Labels ────────────────────────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  weight: 'Peso',
  height: 'Altezza',
  gender: 'Sesso',
  age: 'Età osservata',
  birthDate: 'Data di nascita',
  name: 'Nome',
  smokingStatus: 'Stato fumatore',
  goal: 'Obiettivo',
  declared_goal: 'Obiettivo dichiarato',
  blood_pressure: 'Pressione',
  symptoms: 'Sintomi',
  diagnosis: 'Diagnosi',
  medications: 'Farmaci',
  complaint: 'Motivo consulto',
  restingHr: 'Freq. cardiaca a riposo',
  hypertension: 'Ipertensione',
  allergy: 'Allergie',
  meal_pattern: 'Schema pasti',
  food_triggers: 'Trigger alimentari',
  metabolic_condition: 'Condizione metabolica',
  dietType: 'Tipo di dieta',
  intolerances: 'Intolleranze',
  training_frequency_per_week: 'Allenamenti/settimana',
  fitness_level: 'Livello fitness',
  sport: 'Sport',
  injury: 'Infortuni',
  stress_level: 'Stress',
  sleep_hours: 'Ore di sonno',
  sleep_quality: 'Qualità del sonno',
  distress_intensity: 'Intensità disagio',
}

const DOMAIN_LABELS: Record<string, string> = {
  personal: 'Dati Personali',
  health: 'Salute',
  nutrition: 'Nutrizione',
  training: 'Allenamento',
  mindfulness: 'Benessere Mentale',
  general: 'Generale',
  career: 'Carriera',
  financial: 'Finanze',
}

const DOMAIN_ORDER = [
  'personal',
  'health',
  'nutrition',
  'training',
  'mindfulness',
  'general',
  'career',
  'financial',
]

// Completeness config — must match what agents save
const COMPLETENESS = [
  {
    domain: 'personal',
    label: 'Dati Personali',
    keys: ['weight', 'height', 'gender', 'birthDate', 'age'],
    color: '#8E8E93',
  },
  {
    domain: 'health',
    label: 'Salute',
    keys: ['blood_pressure', 'symptoms', 'diagnosis', 'medications', 'complaint'],
    color: '#FF3B30',
  },
  {
    domain: 'nutrition',
    label: 'Nutrizione',
    keys: ['allergy', 'goal', 'meal_pattern', 'metabolic_condition', 'food_triggers'],
    color: '#34C759',
  },
  {
    domain: 'training',
    label: 'Allenamento',
    keys: ['training_frequency_per_week', 'fitness_level', 'goal', 'injury', 'sport'],
    color: '#007AFF',
  },
  {
    domain: 'mindfulness',
    label: 'Benessere Mentale',
    keys: ['stress_level', 'sleep_hours', 'sleep_quality', 'complaint', 'distress_intensity'],
    color: '#AF52DE',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key.replace(/_/g, ' ')
}

function formatVal(value: unknown, unit: string | null): string {
  if (value === null || value === undefined) return '—'
  // Handle JSON objects — extract meaningful display value
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    // attachment_file: show filename
    if (typeof obj.filename === 'string') return obj.filename
    // generated_artifact or other objects with title
    if (typeof obj.title === 'string') return obj.title
    // fallback: compact JSON
    return JSON.stringify(obj)
  }
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

// ── Main component ────────────────────────────────────────────────────────────

export function CartellaSection({ data }: Props) {
  const {
    user,
    profile,
    attributesByDomain,
    attributesByDomainHistory,
    derivedFacts,
    dynamicDocuments,
  } = data

  // Completeness — cross-domain check
  const allDomains = attributesByDomain ?? {}
  const completeness = COMPLETENESS.map(({ domain, label, keys, color }) => {
    const hasKey = (k: string) =>
      allDomains[domain]?.[k] !== undefined ||
      allDomains['personal']?.[k] !== undefined ||
      allDomains['general']?.[k] !== undefined ||
      allDomains['health']?.[k] !== undefined

    if (domain === 'personal') {
      const filled =
        (hasKey('weight') ? 1 : 0) +
        (hasKey('height') ? 1 : 0) +
        (hasKey('gender') ? 1 : 0) +
        (hasKey('birthDate') || hasKey('age') ? 1 : 0)
      return { label, pct: Math.round((filled / 4) * 100), color }
    }

    const filled = keys.filter(hasKey).length
    return { label, pct: Math.round((filled / keys.length) * 100), color }
  })

  // User header biometrics
  const age = derivedFacts?.currentAge ?? null

  // All attribute data grouped by domain
  const history = attributesByDomainHistory ?? {}
  const orderedDomains = [
    ...DOMAIN_ORDER.filter((d) => history[d] && Object.keys(history[d]).length > 0),
    ...Object.keys(history).filter(
      (d) => !DOMAIN_ORDER.includes(d) && Object.keys(history[d]).length > 0,
    ),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Utente ── */}
      <div>
        <p style={nameStyle}>{user?.name ?? 'Utente'}</p>
        <p style={subtitleStyle}>
          {[
            age ? `${age} anni` : null,
            profile?.gender ?? null,
            profile?.height ? `${profile.height} cm` : null,
            profile?.weight ? `${profile.weight} kg` : null,
            profile?.weight && profile?.height
              ? `BMI ${(profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Completa il profilo in chat'}
        </p>
      </div>

      {/* ── Completezza ── */}
      <div>
        <p style={sectionLabel}>Completezza Cartella</p>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.5rem' }}
        >
          {completeness.map(({ label, pct, color }) => (
            <div key={label}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}
              >
                <span style={fieldLabel}>{label}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color }}>{pct}%</span>
              </div>
              <div
                style={{
                  height: '5px',
                  backgroundColor: '#E5E5EA',
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
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tutti i dati ── */}
      <div>
        <p style={sectionLabel}>Tutti i dati raccolti</p>
        {orderedDomains.length === 0 ? (
          <p style={emptyStyle}>Nessun dato ancora — parla con il team in chat.</p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              marginTop: '0.5rem',
            }}
          >
            {orderedDomains.map((domain) => {
              const entries = Object.entries(history[domain] ?? {})
              if (entries.length === 0) return null
              return (
                <div key={domain}>
                  <p style={domainLabel}>{DOMAIN_LABELS[domain] ?? domain}</p>
                  {entries.map(([key, attrHistory]) => {
                    const latest = attrHistory[0]
                    if (!latest) return null
                    if (key === 'age' && profile?.birthDate) return null
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
              )
            })}
          </div>
        )}
      </div>

      <div>
        <p style={sectionLabel}>Documenti e Artifact</p>
        {dynamicDocuments?.length ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
              marginTop: '0.5rem',
            }}
          >
            {dynamicDocuments.map((doc) => (
              <div key={`${doc.kind}:${doc.id}`} style={docCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={docTitleStyle}>
                      {doc.kind === 'user_file' ? 'Allegato utente' : 'Artifact AI'}: {doc.title}
                    </p>
                    <p style={docMetaStyle}>
                      {doc.kind === 'user_file' && doc.mimeType ? doc.mimeType : 'Documento'}
                      {doc.size ? ` • ${(doc.size / 1024).toFixed(1)} KB` : ''}
                      {' • '}
                      {formatDateTime(doc.recordedAt)}
                    </p>
                    <p style={docNotesStyle}>{doc.notes}</p>
                    {doc.preview ? <pre style={docPreviewStyle}>{doc.preview}</pre> : null}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.375rem',
                      flexShrink: 0,
                    }}
                  >
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" style={linkStyle}>
                        Anteprima
                      </a>
                    ) : null}
                    <a
                      href={
                        doc.url ??
                        `data:text/markdown;charset=utf-8,${encodeURIComponent(doc.content ?? doc.preview ?? doc.title)}`
                      }
                      download={doc.downloadFilename ?? undefined}
                      style={linkStyle}
                    >
                      Scarica
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={emptyStyle}>Nessun documento o artifact ancora salvato nel dynamic DB.</p>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const nameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.0625rem',
  fontWeight: 700,
  color: 'var(--color-text-primary, #1C1C1E)',
}
const subtitleStyle: React.CSSProperties = {
  margin: '0.125rem 0 0',
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
const sectionLabel: React.CSSProperties = {
  margin: 0,
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}
const domainLabel: React.CSSProperties = {
  margin: '0 0 0.375rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-text-primary, #1C1C1E)',
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
  marginTop: '0.5rem',
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
const docCardStyle: React.CSSProperties = {
  border: '1px solid var(--color-separator, #E5E5EA)',
  borderRadius: '0.875rem',
  padding: '0.875rem',
  background: 'var(--color-surface, #fff)',
}
const docTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--color-text-primary, #1C1C1E)',
}
const docMetaStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary, #8E8E93)',
}
const docNotesStyle: React.CSSProperties = {
  margin: '0.5rem 0 0',
  fontSize: '0.8125rem',
  color: 'var(--color-text-primary, #1C1C1E)',
}
const docPreviewStyle: React.CSSProperties = {
  margin: '0.5rem 0 0',
  padding: '0.625rem',
  fontSize: '0.75rem',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: 'var(--color-bg, #F2F2F7)',
  borderRadius: '0.625rem',
  color: 'var(--color-text-secondary, #3C3C43)',
}
const linkStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-accent, #007AFF)',
  textDecoration: 'none',
}

import type React from 'react'
