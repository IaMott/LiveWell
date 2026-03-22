import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type ClinicalEvent = ProfileData['clinicalEvents'][number]

type Props = { data: ProfileData }

// ── Human-readable labels for attribute keys ─────────────────────────────────
// Keys match what agents save via normalizeKey() + AGENT_INTAKE_KEYS

const KEY_LABELS: Record<string, string> = {
  // Biometric / personal
  weight: 'Peso',
  height: 'Altezza',
  gender: 'Sesso',
  birthDate: 'Data di nascita',
  age: 'Età',
  goal: 'Obiettivo',
  declared_goal: 'Obiettivo dichiarato',

  // Health
  blood_pressure: 'Pressione arteriosa',
  symptoms: 'Sintomi',
  diagnosis: 'Diagnosi',
  medications: 'Farmaci',
  complaint: 'Motivo consulto',
  lifestyle: 'Stile di vita',
  hypertension: 'Ipertensione',
  hypertension_diagnosed_year: 'Anno diagnosi ipertensione',
  medical_condition_note: 'Note condizioni mediche',
  symptom_duration: 'Durata sintomi',
  family_history: 'Familiarità',

  // Nutrition
  allergy: 'Allergie / Intolleranze',
  meal_pattern: 'Schema pasti',
  metabolic_condition: 'Condizioni metaboliche',
  food_triggers: 'Trigger alimentari',
  digestive_symptoms: 'Sintomi digestivi',
  symptom_frequency: 'Frequenza sintomi',
  budget_food: 'Budget alimentare',
  cooking_time: 'Tempo preparazione',
  cooking_experience: 'Esperienza in cucina',
  dietary_restrictions: 'Restrizioni dietetiche',
  supplements_current: 'Integratori attuali',
  functional_goal: 'Obiettivo funzionale',
  lab_results_nutrition: 'Esami nutrizionali',

  // Training
  training_frequency_per_week: 'Allenamenti/settimana',
  fitness_level: 'Livello fitness',
  injury: 'Infortuni',
  sport: 'Sport praticato',
  equipment: 'Attrezzatura',
  body_awareness: 'Consapevolezza corporea',
  physical_activity: 'Attività fisica',

  // Pain / Rehab
  pain_location: 'Localizzazione dolore',
  pain_cause: 'Causa dolore',
  pain_intensity: 'Intensità dolore',
  functional_impact: 'Impatto funzionale',
  functional_status: 'Stato funzionale',
  previous_treatments: 'Trattamenti precedenti',
  rehab_goal: 'Obiettivo riabilitativo',

  // Sleep
  sleep_hours: 'Ore di sonno',
  sleep_latency: 'Latenza addormentamento',
  night_wakings: 'Risvegli notturni',
  sleep_quality: 'Qualità sonno',
  evening_routine: 'Routine serale',

  // Mental health
  stress_level: 'Livello di stress',
  distress_intensity: 'Intensità disagio',
  psychiatric_history: 'Anamnesi psichiatrica',
  substance_use: 'Uso sostanze',
  relational_context: 'Contesto relazionale',
  work_context: 'Contesto lavorativo',
  mental_performance_goal: 'Obiettivo performance mentale',
  difficulty_area: 'Area di difficoltà',
  context: 'Contesto',
  main_problem: 'Problema principale',
  main_complaint: 'Problematica principale',

  // Rheumatology
  joint_pain_location: 'Articolazioni coinvolte',
  joint_stiffness_duration: 'Rigidità mattutina',
  autoimmune_markers: 'Marker autoimmuni',

  // Dermatology
  lesion_type: 'Tipo lesione cutanea',
  lesion_location: 'Zona lesione',
  triggers: 'Fattori scatenanti',
  current_treatment: 'Trattamento in corso',

  // Career / Inspiration
  current_role: 'Ruolo attuale',
  professional_goal: 'Obiettivo professionale',
  main_obstacle: 'Ostacolo principale',
  timeline: 'Tempistica',
  leadership_role: 'Ruolo di leadership',
  team_context: 'Contesto team',
  main_challenge: 'Sfida principale',
  analysis_domain: 'Dominio di analisi',
  decision_goal: 'Obiettivo decisionale',
  urgency: 'Urgenza',

  // Financial
  activity_type: 'Tipo attività',
  tax_regime: 'Regime fiscale',
  fiscal_situation: 'Situazione fiscale',
  upcoming_deadlines: 'Scadenze',
  income_range: 'Range reddito',
  expenses: 'Spese principali',
  savings: 'Risparmi',
  financial_goal: 'Obiettivo finanziario',
  risk_tolerance: 'Tolleranza al rischio',
  debts: 'Debiti',

  // Legal
  legal_issue_type: 'Tipo questione legale',
  case_status: 'Stato pratica',
  objective: 'Obiettivo',
  documentation: 'Documentazione',

  // Life organizer
  organizational_goal: 'Obiettivo organizzativo',
  constraints: 'Vincoli',
  current_tools: 'Strumenti attuali',

  // Relationship
  relationship_type: 'Tipo relazione',
  problem_duration: 'Durata problema',
}

// Domain display config
const DOMAIN_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  health: { label: 'Salute', emoji: '❤️', color: '#FF3B30' },
  nutrition: { label: 'Nutrizione', emoji: '🍎', color: '#34C759' },
  training: { label: 'Allenamento', emoji: '💪', color: '#007AFF' },
  mindfulness: { label: 'Benessere Mentale', emoji: '🧠', color: '#AF52DE' },
  personal: { label: 'Dati Personali', emoji: '👤', color: '#8E8E93' },
  general: { label: 'Generale', emoji: '📋', color: '#FF9F0A' },
  career: { label: 'Carriera', emoji: '💼', color: '#FF6B35' },
  financial: { label: 'Finanze', emoji: '💰', color: '#5AC8FA' },
}

// Keys to track completeness — must match what agents actually save
const DOMAIN_COMPLETENESS = [
  {
    domain: 'health',
    label: 'Salute',
    keys: [
      'weight',
      'height',
      'blood_pressure',
      'symptoms',
      'diagnosis',
      'medications',
      'complaint',
    ],
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sì' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ')
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function labelForKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key]
  // Fallback: convert snake_case to Title Case
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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

function AttributeRow({
  label,
  value,
  unit,
}: {
  label: string
  value: unknown
  unit: string | null
}) {
  const display = formatValue(value)
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--color-separator, #F2F2F7)',
        gap: '1rem',
      }}
    >
      <span
        style={{
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary, #8E8E93)',
          flexShrink: 0,
          maxWidth: '40%',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: 'var(--color-text-primary, #1C1C1E)',
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {display}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

function DomainCard({
  domain,
  attrs,
}: {
  domain: string
  attrs: Record<string, { value: unknown; unit: string | null }>
}) {
  const config = DOMAIN_CONFIG[domain] ?? {
    label: labelForKey(domain),
    emoji: '📌',
    color: '#8E8E93',
  }
  const entries = Object.entries(attrs)
  if (entries.length === 0) return null

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface, #fff)',
        borderRadius: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Domain header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: `2px solid ${config.color}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1.125rem' }}>{config.emoji}</span>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--color-text-primary, #1C1C1E)',
          }}
        >
          {config.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: config.color,
            backgroundColor: `${config.color}15`,
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
          }}
        >
          {entries.length} {entries.length === 1 ? 'dato' : 'dati'}
        </span>
      </div>

      {/* Attribute rows */}
      <div style={{ padding: '0.25rem 1rem' }}>
        {entries.map(([key, attr]) => (
          <AttributeRow key={key} label={labelForKey(key)} value={attr.value} unit={attr.unit} />
        ))}
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
      {/* Timeline dot */}
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
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
            {formatDate(event.eventDate)}
          </span>

          {event.severity && (
            <span
              style={{
                fontSize: '0.75rem',
                color: SEVERITY_COLOR[event.severity] ?? '#8E8E93',
                fontWeight: 500,
              }}
            >
              {event.severity === 'low' ? 'Bassa' : event.severity === 'medium' ? 'Media' : 'Alta'}
            </span>
          )}

          {event.validUntil && (
            <span style={{ fontSize: '0.75rem', color: '#8E8E93' }}>
              Fino al {formatDate(event.validUntil)}
            </span>
          )}

          {event.agentId && (
            <span style={{ fontSize: '0.75rem', color: '#8E8E93' }}>{event.agentId}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CartellaSection({ data }: Props) {
  const { clinicalEvents, attributesByDomain, profile, user } = data

  // Calcola completezza dai domini chiave (con key reali)
  const completeness = DOMAIN_COMPLETENESS.map(({ domain, label, keys, color }) => {
    const attrs = attributesByDomain?.[domain] ?? {}
    const filled = keys.filter((k) => attrs[k] !== undefined).length
    const pct = Math.round((filled / keys.length) * 100)
    return { domain, label, pct, color }
  })

  // Domini con dati da mostrare (ordine: personal → health → nutrition → training → mindfulness → rest)
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
  const domainsWithData = DOMAIN_ORDER.filter(
    (d) => attributesByDomain?.[d] && Object.keys(attributesByDomain[d]).length > 0,
  )
  // Add any domains not in the predefined order
  if (attributesByDomain) {
    for (const d of Object.keys(attributesByDomain)) {
      if (!DOMAIN_ORDER.includes(d) && Object.keys(attributesByDomain[d]).length > 0) {
        domainsWithData.push(d)
      }
    }
  }
  const totalAttributes = domainsWithData.reduce(
    (sum, d) => sum + Object.keys(attributesByDomain?.[d] ?? {}).length,
    0,
  )

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

      {/* ── Dati raccolti dal team (IL DATABASE DINAMICO) ── */}
      {totalAttributes > 0 ? (
        <>
          <h3 style={sectionHeaderStyle}>Dati raccolti ({totalAttributes})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {domainsWithData.map((domain) => (
              <DomainCard key={domain} domain={domain} attrs={attributesByDomain![domain]} />
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(52,199,89,0.06)',
            borderRadius: '1rem',
            padding: '1rem',
            borderLeft: '3px solid #34C759',
          }}
        >
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 700 }}>
            Cartella Clinica
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary, #8E8E93)',
              lineHeight: 1.4,
            }}
          >
            I tuoi dati sanitari appariranno qui man mano che parli con il team. Viene aggiornata
            automaticamente durante le conversazioni.
          </p>
        </div>
      )}

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
          Parla con il team in chat per completare la tua cartella
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
