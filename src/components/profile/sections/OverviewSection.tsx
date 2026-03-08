import Link from 'next/link'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function OverviewSection({ data }: Props) {
  const { profile, stats, artifacts } = data
  const hasActivity =
    stats.workoutSessions7d > 0 ||
    stats.mealsLogged7d > 0 ||
    stats.avgMood7d !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Quick stats */}
      {hasActivity ? (
        <section>
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 0.5rem',
            }}
          >
            Ultimi 7 giorni
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
            }}
          >
            <StatCard
              label="Allenamenti"
              value={stats.workoutSessions7d}
              color="#007AFF"
            />
            <StatCard
              label="Minuti attivi"
              value={stats.totalWorkoutMin7d}
              unit="min"
              color="#007AFF"
            />
            <StatCard
              label="Pasti registrati"
              value={stats.mealsLogged7d}
              color="#AF52DE"
            />
            {stats.avgMood7d !== null && (
              <StatCard
                label="Umore medio"
                value={`${Math.round(stats.avgMood7d)}/10`}
                color="#5AC8FA"
              />
            )}
            {stats.lastWeightEntry && (
              <StatCard
                label="Peso"
                value={stats.lastWeightEntry.value}
                unit={stats.lastWeightEntry.unit}
                color="#34C759"
              />
            )}
            {profile?.height && (
              <StatCard label="Altezza" value={profile.height} unit="cm" />
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          message="Non ci sono ancora dati. Inizia a parlare con il tuo team per costruire il tuo profilo."
          cta="Inizia la conversazione"
        />
      )}

      {/* Profile completeness */}
      {profile && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              margin: '0 0 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Conversazioni totali
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--color-accent)',
            }}
          >
            {stats.conversationCount}
          </p>
        </div>
      )}

      {/* Recent recommendations */}
      {artifacts.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 0.5rem',
            }}
          >
            Raccomandazioni recenti
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {artifacts.slice(0, 3).map((a) => (
              <div
                key={a.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '1rem',
                  padding: '0.875rem 1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {a.title}
                </p>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {a.type} ·{' '}
                  {new Date(a.createdAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <Link
        href="/"
        style={{
          display: 'block',
          padding: '1rem',
          backgroundColor: 'var(--color-text-primary)',
          borderRadius: '1rem',
          textAlign: 'center',
          textDecoration: 'none',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 600,
        }}
      >
        Continua con il tuo team →
      </Link>
    </div>
  )
}
