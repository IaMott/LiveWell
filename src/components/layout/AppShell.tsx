'use client'

import { type ReactNode } from 'react'
import { TopBar } from './TopBar'
import { MoodGradient } from '@/components/mood/MoodGradient'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-surface">
      <MoodGradient />
      <TopBar />
      <main className={cn('relative z-10 flex min-h-0 flex-1 flex-col', className)}>
        {children}
      </main>
    </div>
  )
}
