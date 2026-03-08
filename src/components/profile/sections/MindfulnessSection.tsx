import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function MindfulnessSection({ data }: Props) {
  const { stats, recentMindfulness } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {stats.avgMood7d !== null && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.5rem',
          }}
        >
          <StatCard
            label="Umore medio (7gg)"
            value={`${Math.round(stats.avgMood7d)}/10`}
            color="#5AC8FA"
          />
          {stats.avgStress7d !== null && (
            <StatCard
              label="Stress medio (7gg)"
              value={`${Math.round(stats.avgStress7d)}/10`}
              color="#FF9F0A"
            />
          )}
        </div>
      )}

      {recentMindfulness.length > 0 ? (
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
              backgroundColor: 'var(--color-surface)',
              borderRadius: '1rem',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {recentMindfulness.map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderBottom:
                    idx < recentMindfulness.length - 1
                      ? '1px solid var(--color-separator)'
                      : 'none',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  {new Date(entry.createdAt).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {entry.mood !== null && (
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#5AC8FA',
                      }}
                    >
                      😊 {entry.mood}/10
                    </span>
                  )}
                  {entry.stress !== null && (
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#FF9F0A',
                      }}
                    >
                      😰 {entry.stress}/10
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          message="Nessun dato di benessere questa settimana. Il tuo mental coach registrerà umore e stress nel tempo."
          cta="Parla con il mental coach"
        />
      )}
    </div>
  )
}
