export type DynamicValueSemantics =
  | 'static_identity'
  | 'observed_measurement'
  | 'observed_temporal_snapshot'
  | 'derived_temporal'
  | 'document_reference'
  | 'generated_artifact'
  | 'generic'

export type DynamicFieldDescriptor = {
  key: string
  semantics: DynamicValueSemantics
  mutableOverTime: boolean
  derivedFrom?: string[]
  displayLabel?: string
  promptHint?: string
}

const STATIC_IDENTITY_KEYS = new Set([
  'birthdate',
  'birth_date',
  'gender',
  'sex',
  'sesso',
  'blood_type',
  'name',
])

const OBSERVED_TEMPORAL_KEYS = new Set(['age', 'eta', 'età'])

const OBSERVED_MEASUREMENT_KEYS = new Set([
  'weight',
  'height',
  'bmi',
  'stress_level',
  'sleep_hours',
  'sleep_quality',
  'blood_pressure',
  'restinghr',
  'resting_heart_rate',
  'training_frequency_per_week',
  'distress_intensity',
])

function normalize(key: string): string {
  return key.trim().toLowerCase()
}

export function getDynamicFieldDescriptor(key: string): DynamicFieldDescriptor {
  const normalized = normalize(key)

  if (STATIC_IDENTITY_KEYS.has(normalized)) {
    return {
      key,
      semantics:
        normalized === 'birthdate' || normalized === 'birth_date'
          ? 'derived_temporal'
          : 'static_identity',
      mutableOverTime: normalized === 'birthdate' || normalized === 'birth_date',
      derivedFrom:
        normalized === 'birthdate' || normalized === 'birth_date'
          ? ['birthDate', 'now']
          : undefined,
      displayLabel:
        normalized === 'birthdate' || normalized === 'birth_date' ? 'Data di nascita' : undefined,
      promptHint:
        normalized === 'birthdate' || normalized === 'birth_date'
          ? 'dato base per derivare età e altri calcoli temporali'
          : 'dato identitario relativamente stabile',
    }
  }

  if (OBSERVED_TEMPORAL_KEYS.has(normalized)) {
    return {
      key,
      semantics: 'observed_temporal_snapshot',
      mutableOverTime: true,
      derivedFrom: ['recordedAt'],
      displayLabel: 'Età osservata',
      promptHint:
        "istantanea temporale dichiarata dall'utente; non trattarla come età corrente certa se manca birthDate",
    }
  }

  if (normalized === 'attachment_file') {
    return {
      key,
      semantics: 'document_reference',
      mutableOverTime: false,
      displayLabel: 'Allegato utente',
      promptHint: 'documento caricato dall’utente, consultabile nel dynamic DB',
    }
  }

  if (normalized === 'generated_artifact') {
    return {
      key,
      semantics: 'generated_artifact',
      mutableOverTime: false,
      displayLabel: 'Artifact generato',
      promptHint: 'artifact prodotto dal sistema multi-agente e salvato nel dynamic DB',
    }
  }

  if (OBSERVED_MEASUREMENT_KEYS.has(normalized)) {
    return {
      key,
      semantics: 'observed_measurement',
      mutableOverTime: true,
      derivedFrom: ['recordedAt'],
      promptHint: 'misurazione o stato osservato; usa latest + history',
    }
  }

  return {
    key,
    semantics: 'generic',
    mutableOverTime: false,
  }
}

export function computeAgeFromBirthDate(
  birthDateIso: string | Date | null | undefined,
  now = new Date(),
): number | null {
  if (!birthDateIso) return null
  const birthDate = birthDateIso instanceof Date ? birthDateIso : new Date(birthDateIso)
  if (Number.isNaN(birthDate.getTime())) return null
  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--
  return age >= 0 ? age : null
}

export function semanticDisplayLabel(key: string): string {
  return getDynamicFieldDescriptor(key).displayLabel ?? key
}
