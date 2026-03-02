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

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => setProfile(d.profile))
      .catch(() => setError('Errore nel caricamento del profilo'))
      .finally(() => setLoading(false))
  }, [])

  const saveSection = useCallback(
    async (section: string, data: Record<string, unknown>) => {
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
        // Refresh profile
        const fresh = await fetch('/api/profile')
        const d = await fresh.json()
        setProfile(d.profile)
        setSuccess('Salvato con successo')
        setTimeout(() => setSuccess(''), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore nel salvataggio')
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { profile, loading, saving, error, success, saveSection }
}
