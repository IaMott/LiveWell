'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Apple, Dumbbell, Heart, Brain, Lightbulb, LayoutDashboard } from 'lucide-react'

const TABS = [
  { slug: 'overview', label: 'Overview', icon: LayoutDashboard, color: '#8E8E93' },
  { slug: 'nutrizione', label: 'Nutrizione', icon: Apple, color: '#AF52DE' },
  { slug: 'allenamento', label: 'Allenamento', icon: Dumbbell, color: '#007AFF' },
  { slug: 'salute', label: 'Salute', icon: Heart, color: '#34C759' },
  { slug: 'mindfulness', label: 'Mindfulness', icon: Brain, color: '#5AC8FA' },
  { slug: 'idee', label: 'Idee', icon: Lightbulb, color: '#FF9F0A' },
] as const

export function ProfileNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        padding: '0 0.75rem',
        gap: '0.25rem',
        borderBottom: '1px solid var(--color-separator)',
        paddingBottom: '0',
      }}
    >
      {TABS.map(({ slug, label, icon: Icon, color }) => {
        const isActive = pathname === `/profile/${slug}`
        return (
          <Link
            key={slug}
            href={`/profile/${slug}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.625rem 0.75rem 0.5rem',
              textDecoration: 'none',
              color: isActive ? color : 'var(--color-text-secondary)',
              borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 0.15s',
            }}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span style={{ fontSize: '0.6875rem', fontWeight: isActive ? 600 : 400 }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
