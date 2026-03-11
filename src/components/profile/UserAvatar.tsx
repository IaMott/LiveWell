import Link from 'next/link'

type Props = {
  name?: string | null
  imageUrl?: string | null
  initialsOverride?: string
  size?: number
  href?: string
  ariaLabel?: string
}

function computeInitials(name?: string | null, fallback = 'ME'): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return fallback

  const initials = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()

  return initials || fallback
}

function AvatarCore({
  name,
  imageUrl,
  initialsOverride,
  size = 40,
  ariaLabel,
}: Omit<Props, 'href'>) {
  const initials = initialsOverride ?? computeInitials(name, 'ME')

  return (
    <div
      aria-label={ariaLabel}
      title={name ?? 'Profilo utente'}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-text-primary)',
        color: 'var(--color-bg)',
        border: '1px solid var(--color-separator)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(12, Math.round(size * 0.34))}px`,
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name ? `Immagine profilo di ${name}` : 'Immagine profilo'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        initials
      )}
    </div>
  )
}

export function UserAvatar(props: Props) {
  if (props.href) {
    return (
      <Link
        href={props.href}
        aria-label={props.ariaLabel ?? 'Vai al profilo'}
        style={{ textDecoration: 'none', display: 'inline-flex' }}
      >
        <AvatarCore {...props} />
      </Link>
    )
  }

  return <AvatarCore {...props} />
}
