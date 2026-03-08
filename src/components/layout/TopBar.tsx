import { Settings } from 'lucide-react'

export function TopBar() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3.5rem 1rem 0.75rem',
      }}
    >
      <button
        aria-label="Impostazioni"
        style={{
          width: '2.25rem',
          height: '2.25rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-primary)',
        }}
      >
        <Settings size={22} strokeWidth={1.5} />
      </button>

      <div
        aria-label="Profilo utente"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '50%',
          backgroundColor: 'var(--color-text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '0.875rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        MM
      </div>
    </header>
  )
}
