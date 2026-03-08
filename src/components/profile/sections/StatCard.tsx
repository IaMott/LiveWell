type Props = {
  label: string
  value: string | number
  unit?: string
  color?: string
}

export function StatCard({ label, value, unit, color }: Props) {
  return (
    <div
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
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '0.25rem 0 0',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: color ?? 'var(--color-text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: '0.875rem', fontWeight: 500, marginLeft: '0.25rem' }}>
            {unit}
          </span>
        )}
      </p>
    </div>
  )
}
