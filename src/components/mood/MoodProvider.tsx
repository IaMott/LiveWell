'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

export type MoodLevel = 'low' | 'medium' | 'high' | 'excellent'

interface MoodColors {
  start: string
  end: string
}

const MOOD_PALETTE: Record<MoodLevel, MoodColors> = {
  low: { start: '#ef4444', end: '#f97316' },
  medium: { start: '#f59e0b', end: '#22c55e' },
  high: { start: '#22c55e', end: '#3b82f6' },
  excellent: { start: '#8b5cf6', end: '#ec4899' },
}

interface MoodContextValue {
  mood: MoodLevel
  colors: MoodColors
  setMood: (mood: MoodLevel) => void
}

const MoodContext = createContext<MoodContextValue | null>(null)

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMoodState] = useState<MoodLevel>('high')

  const setMood = useCallback((level: MoodLevel) => {
    setMoodState(level)
    if (typeof document !== 'undefined') {
      const colors = MOOD_PALETTE[level]
      document.documentElement.style.setProperty('--color-mood-start', colors.start)
      document.documentElement.style.setProperty('--color-mood-end', colors.end)
    }
  }, [])

  const value = useMemo(
    () => ({ mood, colors: MOOD_PALETTE[mood], setMood }),
    [mood, setMood],
  )

  return <MoodContext value={value}>{children}</MoodContext>
}

export function useMood() {
  const ctx = useContext(MoodContext)
  if (!ctx) throw new Error('useMood must be used within MoodProvider')
  return ctx
}
