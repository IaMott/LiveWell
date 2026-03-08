import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function TrainingSection({ data }: Props) {
  const { stats, recentWorkouts } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem',
        }}
      >
        <StatCard label="Sessioni (7gg)" value={stats.workoutSessions7d} color="#007AFF" />
        <StatCard
          label="Minuti totali"
          value={stats.totalWorkoutMin7d}
          unit="min"
          color="#007AFF"
        />
      </div>

      {recentWorkouts.length > 0 ? (
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
            Sessioni recenti
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentWorkouts.map((session) => (
              <div
                key={session.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
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
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {session.durationMin} min
                    {session.perceivedEffort !== null && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.8125rem',
                          fontWeight: 400,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        RPE {session.perceivedEffort}/10
                      </span>
                    )}
                  </p>
                  {session.notes && (
                    <p
                      style={{
                        margin: '0.25rem 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {session.notes}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {new Date(session.date).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          message="Nessuna sessione registrata questa settimana. Il tuo personal trainer ti preparerà un piano."
          cta="Parla con il personal trainer"
        />
      )}
    </div>
  )
}
