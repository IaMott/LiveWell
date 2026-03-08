import Link from 'next/link'

type Props = {
  message: string
  cta?: string
}

export function EmptyState({ message, cta = 'Parla con il tuo team' }: Props) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '1rem',
        padding: '2rem 1.25rem',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <p
        style={{
          margin: '0 0 0.75rem',
          fontSize: '0.9375rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        {message}
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1.25rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--color-text-primary)',
          color: '#fff',
          fontSize: '0.875rem',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        {cta} →
      </Link>
    </div>
  )
}
