'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useProfile } from '@/hooks/useProfile'

type ProfileState = ReturnType<typeof useProfile>

const ProfileStateContext = createContext<ProfileState | null>(null)

interface ProfileStateProviderProps {
  children: ReactNode
}

export function ProfileStateProvider({ children }: ProfileStateProviderProps) {
  const profileState = useProfile()
  return (
    <ProfileStateContext.Provider value={profileState}>{children}</ProfileStateContext.Provider>
  )
}

export function useProfileState(): ProfileState {
  const context = useContext(ProfileStateContext)
  if (!context) {
    throw new Error('useProfileState deve essere usato dentro ProfileStateProvider')
  }
  return context
}
