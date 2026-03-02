'use client'

export function PersonalPageContent() {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-xl font-semibold text-on-surface">Dati Personali</h2>
      <p className="text-on-surface-muted">
        Nome, età, altezza, peso e altre informazioni personali.
      </p>
      <div className="rounded-[var(--radius-card)] border border-surface-dim bg-surface-dim/50 p-6 text-center text-sm text-on-surface-muted">
        Modulo in arrivo (STEP 10)
      </div>
    </div>
  )
}
