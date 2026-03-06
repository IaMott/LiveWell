'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ProfileData {
  birthDate: string | null
  gender: string | null
  height: number | null
  weight: number | null
  health: Record<string, unknown> | null
  nutrition: Record<string, unknown> | null
  training: Record<string, unknown> | null
  mindfulness: Record<string, unknown> | null
  goals: Record<string, unknown> | null
  settings: Record<string, unknown> | null
}

export type ProfileCompletenessSection =
  | 'personal'
  | 'health'
  | 'nutrition'
  | 'training'
  | 'mindfulness'
  | 'goals'

export interface ProfileCompletenessItem {
  section: ProfileCompletenessSection
  completion: number
  missingFields: string[]
  nextField: string | null
}

interface UseProfileOptions {
  loadProfile?: boolean
  loadCompleteness?: boolean
}

export function useProfile(options: UseProfileOptions = {}) {
  const { loadProfile: shouldLoadProfile = true, loadCompleteness: shouldLoadCompleteness = true } =
    options

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(shouldLoadProfile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [completeness, setCompleteness] = useState<
    Record<ProfileCompletenessSection, ProfileCompletenessItem>
  >({
    personal: { section: 'personal', completion: 0, missingFields: [], nextField: null },
    health: { section: 'health', completion: 0, missingFields: [], nextField: null },
    nutrition: { section: 'nutrition', completion: 0, missingFields: [], nextField: null },
    training: { section: 'training', completion: 0, missingFields: [], nextField: null },
    mindfulness: { section: 'mindfulness', completion: 0, missingFields: [], nextField: null },
    goals: { section: 'goals', completion: 0, missingFields: [], nextField: null },
  })
  const [completenessLoading, setCompletenessLoading] = useState(shouldLoadCompleteness)
  const [completenessError, setCompletenessError] = useState('')
  const [overallCompletion, setOverallCompletion] = useState(0)

  const loadProfile = useCallback(async () => {
    if (!shouldLoadProfile) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) {
        throw new Error('Errore nel caricamento del profilo')
      }
      const data = await response.json()
      setProfile(data.profile ?? null)
    } catch {
      setError('Errore nel caricamento del profilo')
    } finally {
      setLoading(false)
    }
  }, [shouldLoadProfile])

  const loadCompleteness = useCallback(async () => {
    if (!shouldLoadCompleteness) return
    setCompletenessLoading(true)
    setCompletenessError('')
    try {
      const response = await fetch('/api/profile/completeness')
      if (!response.ok) {
        throw new Error('Errore nel caricamento della completezza profilo')
      }
      const data = (await response.json()) as {
        sections?: ProfileCompletenessItem[]
        overallCompletion?: number
      }
      if (Array.isArray(data.sections)) {
        setCompleteness((current) => {
          const next = { ...current }
          for (const section of data.sections) {
            next[section.section] = section
          }
          return next
        })
      }
      setOverallCompletion(typeof data.overallCompletion === 'number' ? data.overallCompletion : 0)
    } catch {
      setCompletenessError('Errore nel caricamento completezza')
    } finally {
      setCompletenessLoading(false)
    }
  }, [shouldLoadCompleteness])

  useEffect(() => {
    if (shouldLoadProfile) {
      void loadProfile()
    }
    if (shouldLoadCompleteness) {
      void loadCompleteness()
    }
  }, [loadProfile, loadCompleteness, shouldLoadProfile, shouldLoadCompleteness])

  const saveSection = useCallback(
    async (section: string, data: object) => {
      setSaving(true)
      setError('')
      setSuccess('')
      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, data }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Errore nel salvataggio')
        }
        await Promise.all([loadProfile(), loadCompleteness()])
        setSuccess('Salvato con successo')
        setTimeout(() => setSuccess(''), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore nel salvataggio')
      } finally {
        setSaving(false)
      }
    },
    [loadCompleteness, loadProfile],
  )

  const getSectionCompleteness = useCallback(
    (section: ProfileCompletenessSection): ProfileCompletenessItem => completeness[section],
    [completeness],
  )

  return {
    profile,
    loading,
    saving,
    error,
    success,
    saveSection,
    completeness,
    overallCompletion,
    completenessLoading,
    completenessError,
    getSectionCompleteness,
    refreshCompleteness: loadCompleteness,
  }
}
