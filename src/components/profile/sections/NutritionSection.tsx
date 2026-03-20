'use client'

import type { ProfileData } from '@/app/(app)/profile/[domain]/page'
import type React from 'react'

type Props = { data: ProfileData }

const MEAL_TYPES = [
  { key: 'colazione', label: 'Colazione', emoji: '☀️', color: '#FF9F0A' },
  { key: 'pranzo', label: 'Pranzo', emoji: '🥗', color: '#34C759' },
  { key: 'cena', label: 'Cena', emoji: '🍽️', color: '#5AC8FA' },
  { key: 'spuntino', label: 'Spuntino', emoji: '🍎', color: '#AF52DE' },
]

/**
 * C2 — toolRegistry stores English enum values ('breakfast','lunch','dinner','snack').
 * Map them to the Italian UI keys used by MEAL_TYPES so meals appear correctly.
 */
const MEAL_TYPE_DB_TO_IT: Record<string, string> = {
  breakfast: 'colazione',
  lunch: 'pranzo',
  dinner: 'cena',
  snack: 'spuntino',
}

function MacroRing({
  value,
  max,
  color,
  label,
  unit,
}: {
  value: number
  max: number
  color: string
  label: string
  unit: string
}) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, max > 0 ? value / max : 0)
  const dash = circ * pct

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        <svg viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke="var(--color-separator, #E5E5EA)"
            strokeWidth="7"
          />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #1C1C1E)',
              lineHeight: 1,
            }}
          >
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <span
        style={{
          fontSize: '0.6875rem',
          color: 'var(--color-text-secondary, #8E8E93)',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-text-primary, #1C1C1E)',
        }}
      >
        {value}{' '}
        <span style={{ fontWeight: 400, color: 'var(--color-text-secondary, #8E8E93)' }}>
          {unit}
        </span>
      </span>
    </div>
  )
}

function AttrRow({
  label,
  value,
  unit,
  alert,
}: {
  label: string
  value: unknown
  unit?: string | null
  alert?: boolean
}) {
  const display = value == null || value === '' ? '—' : String(value)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #8E8E93)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: alert && display !== '—' ? '#FF9F0A' : 'var(--color-text-primary, #1C1C1E)',
          maxWidth: '60%',
          textAlign: 'right',
        }}
      >
        {display}
        {unit && display !== '—' ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

export function NutritionSection({ data }: Props) {
  const { stats, recentMeals, profile, attributesByDomain } = data

  const nutAttrs = attributesByDomain?.['nutrition'] ?? {}
  const nutritionProfile = profile?.nutrition as Record<string, unknown> | null

  // Daily kcal: prefer agent-collected attr, then profile
  const attrKcal = nutAttrs['daily_kcal']?.value
  const dailyKcal =
    (typeof attrKcal === 'number' ? attrKcal : null) ??
    (nutritionProfile?.dailyKcal != null ? Number(nutritionProfile.dailyKcal) : null)

  // C2 + M5: Group recent meals by type.
  // Normalize DB English values ('breakfast' → 'colazione') before comparing.
  // Removed dead fuzzy startsWith(key.slice(0,4)) which never matched EN↔IT pairs.
  const mealsByType = MEAL_TYPES.map(({ key, label, emoji, color }) => {
    const meals = recentMeals.filter((m) => {
      const raw = m.mealType?.toLowerCase() ?? ''
      const normalized = MEAL_TYPE_DB_TO_IT[raw] ?? raw
      return normalized === key
    })
    return { key, label, emoji, color, meals, count: meals.length }
  })

  // Real macro attributes (collected via chat — no estimated percentages)
  const proteinG = nutAttrs['protein_g']?.value as number | null | undefined
  const carbsG = nutAttrs['carbs_g']?.value as number | null | undefined
  const fatG = nutAttrs['fat_g']?.value as number | null | undefined
  const hasMacroAttrs = proteinG != null || carbsG != null || fatG != null
  // Show the kcal section only when we have a real kcal goal or real macro attrs
  const hasAnyMacroData = dailyKcal != null || hasMacroAttrs

  // Cartella nutrizionale items
  const nutCartella = [
    { label: 'Obiettivo', key: 'goal', alert: false },
    { label: 'Calorie giornaliere', key: 'daily_kcal', unit: 'kcal' },
    { label: 'Allergie / Intolleranze', key: 'allergy', alert: true },
    { label: 'Restrizioni dietetiche', key: 'dietary_restrictions' },
    { label: 'Schema pasti', key: 'meal_pattern' },
    { label: 'Budget spesa', key: 'budget_food' },
    { label: 'Tempo cottura', key: 'cooking_time' },
  ]
  const hasNutData = nutCartella.some((item) => nutAttrs[item.key]?.value != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-text-primary, #1C1C1E)',
          }}
        >
          Nutrizione
        </h2>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#AF52DE',
            backgroundColor: 'rgba(175,82,222,0.1)',
            borderRadius: '999px',
            padding: '0.2rem 0.625rem',
          }}
        >
          {stats.mealsLogged7d} pasti (7gg)
        </span>
      </div>

      {/* Meal cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {mealsByType.map(({ key, label, emoji, color, meals, count }) => (
          <div
            key={key}
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderRadius: '1rem',
              padding: '0.875rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.375rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary, #1C1C1E)',
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: '1rem' }}>{emoji}</span>
            </div>
            {count > 0 ? (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary, #8E8E93)',
                  }}
                >
                  {count} registrat{count > 1 ? 'i' : 'o'}
                </p>
                {meals[0]?.notes && (
                  <p
                    style={{
                      margin: '0.25rem 0 0',
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }}
                  >
                    {meals[0].notes}
                  </p>
                )}
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary, #8E8E93)',
                }}
              >
                Nessun pasto
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Macro rings */}
      {hasAnyMacroData && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              margin: '0 0 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #8E8E93)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {hasMacroAttrs ? 'Macronutrienti raccolti' : 'Riepilogo nutrizionale'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {/* S4: when kcal goal is set, show it as a target ring (100% = goal defined).
                When no kcal data, show actual meal count vs a 14-meal/week target. */}
            <MacroRing
              value={dailyKcal ?? stats.mealsLogged7d}
              max={dailyKcal ?? Math.max(stats.mealsLogged7d, 14)}
              color="#FF9F0A"
              label={dailyKcal ? 'Obiettivo' : 'Pasti 7gg'}
              unit={dailyKcal ? 'kcal/d' : 'pasti'}
            />
            {hasMacroAttrs && (
              <>
                <MacroRing
                  value={proteinG ?? 0}
                  max={Math.max(proteinG ?? 0, 1)}
                  color="#007AFF"
                  label="Proteine"
                  unit="g"
                />
                <MacroRing
                  value={carbsG ?? 0}
                  max={Math.max(carbsG ?? 0, 1)}
                  color="#34C759"
                  label="Carbo"
                  unit="g"
                />
                <MacroRing
                  value={fatG ?? 0}
                  max={Math.max(fatG ?? 0, 1)}
                  color="#AF52DE"
                  label="Grassi"
                  unit="g"
                />
              </>
            )}
          </div>
          {!hasMacroAttrs && (
            <p
              style={{
                margin: '0.75rem 0 0',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary, #8E8E93)',
                textAlign: 'center',
              }}
            >
              I macronutrienti vengono raccolti automaticamente via chat
            </p>
          )}
        </div>
      )}

      {/* Cartella Nutrizionale */}
      <h3 style={sectionHeaderStyle}>Cartella Nutrizionale</h3>
      {hasNutData ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1rem',
            padding: '0 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {nutCartella.map(({ label, key, alert, unit }, i) => {
            const attr = nutAttrs[key]
            const attrUnit = unit ?? (attr?.unit as string | null | undefined) ?? null
            return (
              <div
                key={key}
                style={{
                  borderBottom:
                    i < nutCartella.length - 1
                      ? '1px solid var(--color-separator, #E5E5EA)'
                      : 'none',
                }}
              >
                <AttrRow label={label} value={attr?.value} unit={attrUnit} alert={alert} />
              </div>
            )
          })}
        </div>
      ) : (
        <ChatCta
          color="#AF52DE"
          text="Parla con il nutrizionista per raccogliere la tua cartella: allergie, obiettivi, restrizioni e piano alimentare."
        />
      )}

      {/* Bottom stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <StatMini label="Pasti (7gg)" value={String(stats.mealsLogged7d)} color="#AF52DE" />
        <StatMini
          label="Obiettivo kcal"
          value={dailyKcal ? `${dailyKcal} kcal` : '—'}
          color="#FF9F0A"
        />
      </div>
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface, #fff)',
        borderRadius: '1rem',
        padding: '0.875rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <p
        style={{
          margin: '0 0 0.25rem',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary, #8E8E93)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color }}>{value}</p>
    </div>
  )
}

function ChatCta({ color, text }: { color: string; text: string }) {
  return (
    <div
      style={{
        backgroundColor: `${color}10`,
        borderRadius: '1rem',
        padding: '1rem',
      }}
    >
      <p
        style={{
          margin: '0 0 0.25rem',
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: 'var(--color-text-primary, #1C1C1E)',
        }}
      >
        💬 Inizia una chat
      </p>
      <p
        style={{
          margin: 0,
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary, #8E8E93)',
          lineHeight: 1.4,
        }}
      >
        {text}
      </p>
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
