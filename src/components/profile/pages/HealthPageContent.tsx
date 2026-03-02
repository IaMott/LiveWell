'use client'

export function HealthPageContent() {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-xl font-semibold text-on-surface">Salute</h2>
      <p className="text-on-surface-muted">
        Condizioni mediche, allergie, farmaci e parametri vitali.
      </p>
      <div className="rounded-[var(--radius-card)] border border-surface-dim bg-surface-dim/50 p-6 text-center text-sm text-on-surface-muted">
        Modulo in arrivo (STEP 10)
      </div>
    </div>
  )
}
