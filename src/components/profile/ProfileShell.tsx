'use client'

import { type ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { ProfileNav } from './ProfileNav'
import { ProfileStateProvider } from './ProfileStateProvider'

interface ProfileShellProps {
  children: ReactNode
}

export function ProfileShell({ children }: ProfileShellProps) {
  return (
    <AppShell>
      <ProfileStateProvider>
        <ProfileNav />
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="mx-auto w-full max-w-2xl">{children}</div>
        </div>
      </ProfileStateProvider>
    </AppShell>
  )
}
