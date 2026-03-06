'use client'

import { type ProfileCompletenessItem } from '@/hooks/useProfile'

const FIELD_LABELS: Record<string, string> = {
  birthDate: 'data di nascita',
  gender: 'sesso',
  height: 'altezza',
  weight: 'peso',
  conditions: 'patologie/condizioni',
  allergies: 'allergie',
  medications: 'farmaci',
  bloodType: 'gruppo sanguigno',
  notes: 'note',
  dietType: 'tipo di dieta',
  intolerances: 'intolleranze',
  preferences: 'preferenze alimentari',
  caloricGoal: 'obiettivo calorico',
  mealsPerDay: 'pasti al giorno',
  fitnessLevel: 'livello fitness',
  equipment: 'attrezzatura',
  weeklyDays: 'giorni allenamento',
  injuries: 'infortuni/limitazioni',
  sport: 'sport',
  stressLevel: 'livello stress',
  meditationExp: 'esperienza meditazione',
  techniques: 'tecniche',
  sleepHours: 'ore di sonno',
  shortTerm: 'obiettivo breve termine',
  mediumTerm: 'obiettivo medio termine',
  longTerm: 'obiettivo lungo termine',
}

type SectionCompletenessHintProps = {
  sectionData: ProfileCompletenessItem
  loading: boolean
  error: string
}

function formatField(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function SectionCompletenessHint({
  sectionData,
  loading,
  error,
}: SectionCompletenessHintProps) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-[var(--radius-card)] border border-surface-dim bg-surface p-3">
        <div className="h-4 w-32 rounded bg-surface-dim" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (sectionData.completion === 100) {
    return (
      <div className="rounded-[var(--radius-card)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        Sezione completa al 100%.
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-medium">
        Completezza: {sectionData.completion}% ({sectionData.missingFields.length} campi mancanti)
      </p>
      {sectionData.nextField ? (
        <p className="mt-1">
          Prossimo dato da completare:{' '}
          <span className="font-medium">{formatField(sectionData.nextField)}</span>
        </p>
      ) : null}
      {sectionData.missingFields.length > 0 ? (
        <p className="mt-1 text-amber-700">
          Mancano: {sectionData.missingFields.slice(0, 3).map(formatField).join(', ')}
          {sectionData.missingFields.length > 3 ? '...' : ''}
        </p>
      ) : null}
    </div>
  )
}
