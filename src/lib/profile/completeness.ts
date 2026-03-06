import { safeParseProfileSectionUpdate } from '@/lib/profile/schema'

export const completenessSectionOrder = [
  'personal',
  'health',
  'nutrition',
  'training',
  'mindfulness',
  'goals',
] as const

export type CompletenessSection = (typeof completenessSectionOrder)[number]

export type SectionCompleteness = {
  section: CompletenessSection
  completion: number
  missingFields: string[]
  nextField: string | null
}

type ProfileCompletenessInput = {
  birthDate: Date | string | null
  gender: string | null
  height: number | null
  weight: number | null
  health: unknown
  nutrition: unknown
  training: unknown
  mindfulness: unknown
  goals: unknown
}

const MVD_FIELDS: Record<CompletenessSection, string[]> = {
  personal: ['birthDate', 'gender', 'height', 'weight'],
  health: ['conditions', 'allergies', 'medications', 'bloodType', 'notes'],
  nutrition: ['dietType', 'intolerances', 'preferences', 'caloricGoal', 'mealsPerDay'],
  training: ['fitnessLevel', 'equipment', 'weeklyDays', 'injuries', 'sport'],
  mindfulness: ['stressLevel', 'meditationExp', 'techniques', 'sleepHours'],
  goals: ['shortTerm', 'mediumTerm', 'longTerm'],
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return false
}

function computeForSection(
  section: CompletenessSection,
  record: Record<string, unknown>,
): SectionCompleteness {
  const requiredFields = MVD_FIELDS[section]
  const missingFields = requiredFields.filter((field) => !hasValue(record[field]))
  const completion =
    requiredFields.length === 0
      ? 100
      : Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100)

  return {
    section,
    completion,
    missingFields,
    nextField: missingFields[0] ?? null,
  }
}

export function computeProfileCompleteness(
  profile: ProfileCompletenessInput | null,
): SectionCompleteness[] {
  if (!profile) {
    return completenessSectionOrder.map((section) => computeForSection(section, {}))
  }

  const parsedSections = {
    health: safeParseProfileSectionUpdate('health', profile.health),
    nutrition: safeParseProfileSectionUpdate('nutrition', profile.nutrition),
    training: safeParseProfileSectionUpdate('training', profile.training),
    mindfulness: safeParseProfileSectionUpdate('mindfulness', profile.mindfulness),
    goals: safeParseProfileSectionUpdate('goals', profile.goals),
  }

  const rawSections = {
    health:
      profile.health && typeof profile.health === 'object' && !Array.isArray(profile.health)
        ? (profile.health as Record<string, unknown>)
        : {},
    nutrition:
      profile.nutrition &&
      typeof profile.nutrition === 'object' &&
      !Array.isArray(profile.nutrition)
        ? (profile.nutrition as Record<string, unknown>)
        : {},
    training:
      profile.training && typeof profile.training === 'object' && !Array.isArray(profile.training)
        ? (profile.training as Record<string, unknown>)
        : {},
    mindfulness:
      profile.mindfulness &&
      typeof profile.mindfulness === 'object' &&
      !Array.isArray(profile.mindfulness)
        ? (profile.mindfulness as Record<string, unknown>)
        : {},
    goals:
      profile.goals && typeof profile.goals === 'object' && !Array.isArray(profile.goals)
        ? (profile.goals as Record<string, unknown>)
        : {},
  }

  const sectionData: Record<CompletenessSection, Record<string, unknown>> = {
    personal: {
      birthDate: profile.birthDate,
      gender: profile.gender,
      height: profile.height,
      weight: profile.weight,
    },
    health: Object.fromEntries(
      Object.keys(parsedSections.health).map((field) => [
        field,
        hasValue(rawSections.health[field]) && hasValue(parsedSections.health[field])
          ? parsedSections.health[field]
          : '',
      ]),
    ),
    nutrition: Object.fromEntries(
      Object.keys(parsedSections.nutrition).map((field) => [
        field,
        hasValue(rawSections.nutrition[field]) && hasValue(parsedSections.nutrition[field])
          ? parsedSections.nutrition[field]
          : '',
      ]),
    ),
    training: Object.fromEntries(
      Object.keys(parsedSections.training).map((field) => [
        field,
        hasValue(rawSections.training[field]) && hasValue(parsedSections.training[field])
          ? parsedSections.training[field]
          : '',
      ]),
    ),
    mindfulness: Object.fromEntries(
      Object.keys(parsedSections.mindfulness).map((field) => [
        field,
        hasValue(rawSections.mindfulness[field]) && hasValue(parsedSections.mindfulness[field])
          ? parsedSections.mindfulness[field]
          : '',
      ]),
    ),
    goals: Object.fromEntries(
      Object.keys(parsedSections.goals).map((field) => [
        field,
        hasValue(rawSections.goals[field]) && hasValue(parsedSections.goals[field])
          ? parsedSections.goals[field]
          : '',
      ]),
    ),
  }

  return completenessSectionOrder.map((section) => computeForSection(section, sectionData[section]))
}
