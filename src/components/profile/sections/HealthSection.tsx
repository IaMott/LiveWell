import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function HealthSection({ data }: Props) {
  const { profile, stats } = data
  const healthProfile = profile?.health as Record<string, unknown> | null

  const vitals = [
    { label: 'Peso', value: stats.lastWeightEntry?.value ?? profile?.weight, unit: stats.lastWeightEntry?.unit ?? 'kg' },
    { label: 'Altezza', value: profile?.height, unit: 'cm' },
  ].filter((v) => v.value != null)

  const hasData = vitals.length > 0 || healthProfile

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {vitals.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.5rem',
          }}
        >
          {vitals.map((v) => (
            <StatCard
              key={v.label}
              label={v.label}
              value={v.value as number}
              unit={v.unit}
              color="#34C759"
            />
          ))}
        </div>
      )}

      {healthProfile && Object.keys(healthProfile).length > 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 0.75rem',
            }}
          >
            Dati clinici
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(healthProfile)
              .slice(0, 6)
              .map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--color-separator)',
                    paddingBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {String(val)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : !hasData ? (
        <EmptyState
          message="Nessun dato di salute registrato. Il tuo medico di base raccoglierà le informazioni necessarie."
          cta="Parla con il medico"
        />
      ) : null}
    </div>
  )
}
