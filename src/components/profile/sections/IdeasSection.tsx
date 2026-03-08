import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { EmptyState } from './EmptyState'

type Props = { data: ProfileData }

export function IdeasSection({ data }: Props) {
  const { artifacts } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {artifacts.length > 0 ? (
        <>
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: 0,
            }}
          >
            Raccomandazioni del team
          </h2>
          {artifacts.map((a) => (
            <div
              key={a.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: '1rem',
                padding: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    flex: 1,
                    paddingRight: '0.5rem',
                  }}
                >
                  {a.title}
                </p>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: '#FF9F0A20',
                    color: '#FF9F0A',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {a.type}
                </span>
              </div>
              {a.contentMarkdown && (
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {a.contentMarkdown.replace(/[#*_`]/g, '')}
                </p>
              )}
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {new Date(a.createdAt).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
          ))}
        </>
      ) : (
        <EmptyState
          message="Nessuna raccomandazione ancora. Il team le genererà man mano che le conversazioni proseguono."
          cta="Inizia una conversazione"
        />
      )}
    </div>
  )
}
