'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import { StatCard } from './StatCard'

type Props = { data: ProfileData }

export function OverviewSection({ data }: Props) {
  const { stats, user, profile, artifacts, attributesByDomain } = data
  const router = useRouter()
  const [resetting, setResetting] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const age = profile?.birthDate
    ? Math.floor(
        (Date.now() - new Date(profile.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      )
    : null

  async function exportDynamicDb() {
    setExporting(true)
    try {
      const res = await fetch('/api/profile/dynamic-db', { method: 'GET' })
      if (!res.ok) throw new Error('Export non disponibile')
      const payload = await res.json()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `livewell-dynamic-db-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function resetData() {
    setResetting(true)
    try {
      await fetch('/api/user/reset-data', { method: 'DELETE' })
      setShowResetModal(false)
      router.refresh()
    } finally {
      setResetting(false)
    }
  }

  // Build active programs from attributesByDomain.program
  // S6: supports both '_' and '-' separators and Italian 'inizio' alias for 'start',
  // so agents that save keys like 'fisioterapista-start' or 'personal_trainer_inizio' are detected.
  const programDomain = attributesByDomain?.['program'] ?? {}
  const agentIds = new Set<string>()
  for (const key of Object.keys(programDomain)) {
    if (key.endsWith('_start') || key.endsWith('-start'))
      agentIds.add(key.replace(/[_-]start$/, ''))
    else if (key.endsWith('_status') || key.endsWith('-status'))
      agentIds.add(key.replace(/[_-]status$/, ''))
    else if (key.endsWith('_inizio') || key.endsWith('-inizio'))
      agentIds.add(key.replace(/[_-]inizio$/, ''))
  }

  const programs = Array.from(agentIds).map((agentId) => {
    const status = String(
      programDomain[`${agentId}_status`]?.value ??
        programDomain[`${agentId}-status`]?.value ??
        'active',
    )
    const startVal =
      programDomain[`${agentId}_start`]?.value ??
      programDomain[`${agentId}-start`]?.value ??
      programDomain[`${agentId}_inizio`]?.value ??
      programDomain[`${agentId}-inizio`]?.value
    const durationVal =
      programDomain[`${agentId}_duration_days`]?.value ??
      programDomain[`${agentId}-duration-days`]?.value
    const startDate = startVal ? new Date(String(startVal)) : null
    const durationDays = durationVal ? Number(durationVal) : null
    const dayElapsed =
      startDate && !isNaN(startDate.getTime())
        ? Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : null
    return { agentId, status, dayElapsed, durationDays }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Reset data modal */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: '1rem',
              padding: '1.25rem',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <h3
              style={{
                margin: '0 0 0.5rem',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              Cancella tutti i dati di test
            </h3>
            <p
              style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.4,
              }}
            >
              Questa azione cancella conversazioni, allenamenti, pasti, attributi e notifiche. Il
              tuo account rimane intatto.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  borderRadius: '0.625rem',
                  border: '1px solid var(--color-separator)',
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                Annulla
              </button>
              <button
                onClick={resetData}
                disabled={resetting}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  borderRadius: '0.625rem',
                  border: 'none',
                  backgroundColor: '#FF3B30',
                  color: '#fff',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  opacity: resetting ? 0.7 : 1,
                }}
              >
                {resetting ? 'Cancello…' : 'Sì, cancella tutto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal card — read-only */}
      <div
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
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Dati personali
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowResetModal(true)}
              disabled={resetting}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,59,48,0.3)',
                background: 'transparent',
                color: '#FF3B30',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: resetting ? 'not-allowed' : 'pointer',
                opacity: resetting ? 0.7 : 1,
              }}
            >
              Reset dati test
            </button>
            <button
              onClick={exportDynamicDb}
              disabled={exporting}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                border: '1px solid var(--color-separator)',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? 'Export…' : 'Export DB dinamico'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Row label="Nome" value={user.name ?? '—'} />
          <Row label="Età" value={age != null && age > 0 ? `${age} anni` : '—'} />
          <Row label="Sesso" value={profile?.gender ?? '—'} />
          <Row label="Altezza" value={profile?.height != null ? `${profile.height} cm` : '—'} />
          <Row label="Peso" value={profile?.weight != null ? `${profile.weight} kg` : '—'} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        <StatCard label="Allenamenti (7gg)" value={stats.workoutSessions7d} color="#007AFF" />
        <StatCard label="Pasti (7gg)" value={stats.mealsLogged7d} color="#AF52DE" />
        {stats.avgMood7d != null && (
          <StatCard
            label="Umore medio"
            value={Math.round(stats.avgMood7d * 10) / 10}
            unit="/10"
            color="#5AC8FA"
          />
        )}
        {stats.lastWeightEntry && (
          <StatCard
            label="Ultimo peso"
            value={stats.lastWeightEntry.value}
            unit={stats.lastWeightEntry.unit}
            color="#34C759"
          />
        )}
      </div>

      {/* Programmi Attivi */}
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
          Programmi Attivi
        </h2>
        {programs.length === 0 ? (
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              margin: 0,
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            Nessun programma attivo — inizia una chat per ricevere un piano personalizzato
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {programs.map((prog) => (
              <div
                key={prog.agentId}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '1rem',
                  padding: '0.75rem 1rem',
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
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {prog.agentId.replace(/-/g, ' ')}
                  </p>
                  <p
                    style={{
                      margin: '0.125rem 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {prog.dayElapsed != null && prog.durationDays != null
                      ? `Giorno ${prog.dayElapsed}/${prog.durationDays}`
                      : prog.dayElapsed != null
                        ? `Giorno ${prog.dayElapsed}`
                        : '—'}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    backgroundColor:
                      prog.status === 'active'
                        ? 'rgba(52,199,89,0.12)'
                        : prog.status === 'completed'
                          ? 'rgba(90,200,250,0.12)'
                          : 'rgba(142,142,147,0.12)',
                    color:
                      prog.status === 'active'
                        ? '#34C759'
                        : prog.status === 'completed'
                          ? '#5AC8FA'
                          : '#8E8E93',
                  }}
                >
                  {prog.status === 'active'
                    ? 'Attivo'
                    : prog.status === 'completed'
                      ? 'Completato'
                      : 'In pausa'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent AI artifacts */}
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
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
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
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  )
}
