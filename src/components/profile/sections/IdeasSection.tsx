'use client'

import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const IDEA_CATEGORIES = [
  {
    title: 'Idee e Ispirazioni Settimanali',
    emoji: '💡',
    color: '#FF9F0A',
    items: [
      'Prepara un pasto sano e nutriente',
      'Nuove tecniche di cottura',
      '+ 10 min. (15 cal-equiv.)',
    ],
  },
  {
    title: 'Hobby Creativo',
    emoji: '🎨',
    color: '#AF52DE',
    items: [
      'Dedicati a un\'attività artistica',
      'Pittura, Scrittura',
      'Musica, ecc.',
      '@ 20 min. (25 cal-equiv.)',
    ],
  },
  {
    title: 'Connessione Locale',
    emoji: '🤝',
    color: '#34C759',
    items: [
      'Partecipa a un evento in città',
      'Mercatini',
      'Attività locali',
      '@ 30 min. (40 cal-equiv.)',
    ],
  },
  {
    title: 'Esplora la Natura',
    emoji: '🌿',
    color: '#5AC8FA',
    items: [
      'Scopri sentieri vicino a te',
      'Parchi urbani',
      'Riserve naturali',
      '@ 45 min. (145 cal-equiv.)',
    ],
  },
]

export function IdeasSection({ data }: Props) {
  const { artifacts } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary, #1C1C1E)' }}>
          Idee e Ispirazioni
        </h2>
        {artifacts.length > 0 && (
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FF9F0A', backgroundColor: 'rgba(255,159,10,0.1)', borderRadius: '999px', padding: '0.2rem 0.625rem' }}>
            {artifacts.length} Nuovi
          </span>
        )}
      </div>

      {/* AI Artifacts from team */}
      {artifacts.length > 0 && (
        <>
          <h3 style={sectionHeaderStyle}>Dal team LiveWell</h3>
          {artifacts.slice(0, 3).map((a) => (
            <div
              key={a.id}
              style={{
                backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem',
                padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                borderLeft: '3px solid #FF9F0A',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary, #1C1C1E)', flex: 1 }}>
                  {a.title}
                </p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary, #8E8E93)', flexShrink: 0, marginLeft: '0.5rem' }}>
                  {new Date(a.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary, #8E8E93)' }}>{a.type}</p>
              {a.contentMarkdown && (
                <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-primary, #1C1C1E)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {a.contentMarkdown.replace(/[#*`]/g, '').slice(0, 120)}
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {/* Idea categories grid */}
      <h3 style={sectionHeaderStyle}>Suggerimenti settimanali</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {IDEA_CATEGORIES.map(({ title, emoji, color, items }) => (
          <div
            key={title}
            style={{
              backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem',
              padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderTop: `3px solid ${color}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary, #1C1C1E)', lineHeight: 1.3 }}>{title}</span>
              <span style={{ fontSize: '1rem', flexShrink: 0, marginLeft: '0.25rem' }}>{emoji}</span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 1rem', listStyle: 'disc' }}>
              {items.slice(0, 3).map((item, i) => (
                <li key={i} style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary, #8E8E93)', marginBottom: '0.125rem', lineHeight: 1.4 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Chat CTA */}
      <div style={{ backgroundColor: 'rgba(255,159,10,0.08)', borderRadius: '1rem', padding: '1rem' }}>
        <p style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary, #1C1C1E)' }}>
          💬 Chiedi al team
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary, #8E8E93)', lineHeight: 1.4 }}>
          Scrivi nella chat per ricevere idee personalizzate basate sui tuoi obiettivi e interessi.
        </p>
      </div>

      {/* Bottom stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        {[
          { label: 'Raccomandazioni', value: String(artifacts.length), color: '#FF9F0A' },
          { label: 'Categorie', value: '4', color: '#AF52DE' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '1rem', padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary, #8E8E93)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0.25rem 0 0', fontSize: '0.8125rem', fontWeight: 600,
  color: 'var(--color-text-secondary, #8E8E93)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
