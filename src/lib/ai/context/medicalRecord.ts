import type { UserAttributes, MedicalRecord } from '../types'

// Essential keys to track completeness per domain — these drive the "cartella clinica"
export const ESSENTIAL_KEYS: Record<string, readonly string[]> = {
  health: [
    'weight',
    'height',
    'birthDate',
    'gender',
    'bloodPressure',
    'restingHr',
    'conditions',
    'medications',
    'allergies',
  ],
  nutrition: ['caloricGoal', 'dietType', 'mealsPerDay', 'waterGoal', 'intolerances'],
  training: ['weeklyFrequency', 'fitnessLevel', 'trainingGoal', 'injuries', 'preferredActivity'],
  mindfulness: ['stressLevel', 'sleepHours', 'meditationFrequency', 'mainStressor'],
  personal: ['occupation', 'lifestyle', 'smokingStatus', 'alcoholFrequency'],
}

/**
 * Computes completeness and missing keys from the current UserAttributes snapshot.
 * Pure function — no DB calls. Expects the attrs already fetched by contextPackBuilder.
 */
export function computeMedicalRecord(attrs: UserAttributes | undefined): MedicalRecord {
  const completeness: MedicalRecord['completeness'] = {}
  const missingKeys: MedicalRecord['missingKeys'] = {}

  for (const [domain, essentialKeys] of Object.entries(ESSENTIAL_KEYS)) {
    const domainAttrs = attrs?.[domain as keyof UserAttributes] ?? {}
    const filled = essentialKeys.filter((k) => domainAttrs[k] !== undefined).length
    const missing = essentialKeys.filter((k) => domainAttrs[k] === undefined)

    completeness[domain] = {
      filled,
      total: essentialKeys.length,
      pct: Math.round((filled / essentialKeys.length) * 100),
    }

    if (missing.length > 0) {
      missingKeys[domain] = missing as string[]
    }
  }

  return { completeness, missingKeys }
}

/**
 * Returns the ordered list of essential keys missing for a specific domain.
 */
export function getMissingEssentialKeys(
  domain: string,
  attrs: UserAttributes | undefined,
): string[] {
  const keys = ESSENTIAL_KEYS[domain] ?? []
  const domainAttrs = attrs?.[domain as keyof UserAttributes] ?? {}
  return (keys as string[]).filter((k) => domainAttrs[k] === undefined)
}
