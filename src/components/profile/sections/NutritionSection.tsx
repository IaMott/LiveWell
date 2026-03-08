import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function NutritionSection({ data }: Props) {
  const { stats, recentMeals, profile } = data
  const nutritionProfile = profile?.nutrition as Record<string, unknown> | null
  const dailyKcal = nutritionProfile?.dailyKcal != null ? Number(nutritionProfile.dailyKcal) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem',
        }}
      >
        <StatCard label="Pasti (7gg)" value={stats.mealsLogged7d} color="#AF52DE" />
        {dailyKcal !== null && (
          <StatCard
            label="Obiettivo kcal"
            value={dailyKcal}
            unit="kcal"
            color="#AF52DE"
          />
        )}
      </div>

      {recentMeals.length > 0 ? (
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
            Ultimi pasti
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentMeals.map((meal) => (
              <div
                key={meal.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '1rem',
                  padding: '0.875rem 1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {meal.mealType}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {new Date(meal.date).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                {meal.notes && (
                  <p
                    style={{
                      margin: '0.25rem 0 0',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {meal.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          message="Nessun pasto registrato questa settimana. Il tuo dietista ti guiderà nella raccolta dei dati."
          cta="Parla con il dietista"
        />
      )}
    </div>
  )
}
