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

const DOMAIN_COLORS: Record<string, string> = {
  health: '#FF3B30',
  nutrition: '#34C759',
  training: '#007AFF',
  mindfulness: '#AF52DE',
  personal: '#8E8E93',
  general: '#8E8E93',
  career: '#FF9500',
  financial: '#FFCC00',
}

export function CartellaSection({ data }: Props) {
  const {
    user,
    profile,
    attributesByDomainHistory,
    derivedFacts,
    dynamicDocuments,
    clinicalEvents,
  } = data

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


      {/* ── Tutti i dati ── */}
      <div>
        <p style={sectionLabel}>Dati del profilo</p>
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

      {/* ── Valutazioni Specialistiche ── */}
      {(() => {
        const assessments = (clinicalEvents ?? []).filter(
          (e) => e.eventType === 'agent_assessment',
        )
        if (assessments.length === 0) return null
        return (
          <div>
            <p style={sectionLabel}>Valutazioni Specialistiche</p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginTop: '0.5rem',
              }}
            >
              {assessments.map((ev) => {
                const meta =
                  ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
                    ? (ev.metadata as Record<string, unknown>)
                    : {}
                const displayName =
                  typeof meta.displayName === 'string' ? meta.displayName : ev.agentId ?? '—'
                const confidence =
                  typeof meta.confidence === 'number'
                    ? `${Math.round(meta.confidence * 100)}%`
                    : null
                const domainColor = DOMAIN_COLORS[ev.domain ?? 'general'] ?? '#8E8E93'
                // Extract just the summary part (after "DisplayName — ")
                const rawTitle = ev.title ?? ''
                const summaryPart = rawTitle.includes(' — ')
                  ? rawTitle.slice(rawTitle.indexOf(' — ') + 3)
                  : rawTitle
                return (
                  <div key={ev.id} style={assessmentCardStyle}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        marginBottom: '0.375rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: domainColor,
                            flexShrink: 0,
                          }}
                        />
                        <span style={assessmentAgentStyle}>{displayName}</span>
                        {confidence && (
                          <span style={{ ...assessmentConfStyle, color: domainColor }}>
                            {confidence}
                          </span>
                        )}
                      </div>
                      <span style={dateStyle}>{formatDateTime(ev.eventDate ?? ev.createdAt)}</span>
                    </div>
                    <p style={assessmentSummaryStyle}>{summaryPart}</p>
                    {ev.description && ev.description.length > 0 && (
                      <p style={assessmentDescStyle}>{ev.description}</p>
                    )}
                    {typeof meta.userMessageExcerpt === 'string' &&
                      meta.userMessageExcerpt.length > 0 && (
                        <p style={assessmentExcerptStyle}>
                          <em>Contesto:</em> &ldquo;{meta.userMessageExcerpt}&rdquo;
                        </p>
                      )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

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
const assessmentCardStyle: React.CSSProperties = {
  border: '1px solid var(--color-separator, #E5E5EA)',
  borderRadius: '0.875rem',
  padding: '0.75rem 0.875rem',
  background: 'var(--color-surface, #fff)',
}
const assessmentAgentStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-text-primary, #1C1C1E)',
}
const assessmentConfStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  background: 'var(--color-bg, #F2F2F7)',
  borderRadius: '0.375rem',
  padding: '0.1rem 0.35rem',
}
const assessmentSummaryStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--color-text-primary, #1C1C1E)',
  lineHeight: 1.45,
}
const assessmentDescStyle: React.CSSProperties = {
  margin: '0.375rem 0 0',
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary, #3C3C43)',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
}
const assessmentExcerptStyle: React.CSSProperties = {
  margin: '0.375rem 0 0',
  fontSize: '0.6875rem',
  color: 'var(--color-text-secondary, #8E8E93)',
  fontStyle: 'italic',
}

import type React from 'react'
