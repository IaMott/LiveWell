'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  User,
  Heart,
  Apple,
  Dumbbell,
  Brain,
  Target,
  Clock,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  { slug: 'personal', label: 'Personale', icon: User },
  { slug: 'health', label: 'Salute', icon: Heart },
  { slug: 'nutrition', label: 'Nutrizione', icon: Apple },
  { slug: 'training', label: 'Allenamento', icon: Dumbbell },
  { slug: 'mindfulness', label: 'Mindfulness', icon: Brain },
  { slug: 'goals', label: 'Obiettivi', icon: Target },
  { slug: 'history', label: 'Storico', icon: Clock },
  { slug: 'settings', label: 'Impostazioni', icon: Settings },
] as const

export function ProfileNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 py-3 scrollbar-none" aria-label="Sezioni profilo">
      {sections.map(({ slug, label, icon: Icon }) => {
        const href = `/profile/${slug}`
        const isActive = pathname === href

        return (
          <Link
            key={slug}
            href={href}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-500 text-white'
                : 'bg-surface-dim text-on-surface-muted hover:bg-surface-bright hover:text-on-surface',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
