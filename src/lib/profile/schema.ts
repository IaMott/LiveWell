import { z } from 'zod'

export const profileSectionEnum = z.enum([
  'personal',
  'health',
  'nutrition',
  'training',
  'mindfulness',
  'goals',
  'settings',
])

export type ProfileSection = z.infer<typeof profileSectionEnum>

const profileDateString = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Data non valida',
)

const text = (max: number) => z.string().trim().max(max)

export const personalSectionSchema = z.object({
  name: text(100).optional(),
  birthDate: z.union([profileDateString, z.null()]).optional(),
  gender: z.union([z.enum(['M', 'F', 'altro']), z.null()]).optional(),
  height: z.union([z.number().min(0).max(300), z.null()]).optional(),
  weight: z.union([z.number().min(0).max(500), z.null()]).optional(),
}).passthrough()

export const healthSectionSchema = z.object({
  conditions: text(2000).optional().default(''),
  allergies: text(1000).optional().default(''),
  medications: text(1000).optional().default(''),
  bloodType: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']).optional().default(''),
  notes: text(2000).optional().default(''),
}).passthrough()

export const nutritionSectionSchema = z.object({
  dietType: text(50).optional().default(''),
  intolerances: text(1000).optional().default(''),
  preferences: text(2000).optional().default(''),
  caloricGoal: z.union([z.string().trim().max(20), z.number().min(800).max(6000)]).optional().default(''),
  mealsPerDay: z.union([z.string().trim().max(5), z.number().min(1).max(12)]).optional().default('3'),
}).passthrough()

export const trainingSectionSchema = z.object({
  fitnessLevel: text(50).optional().default(''),
  equipment: text(1000).optional().default(''),
  weeklyDays: z.union([z.string().trim().max(5), z.number().min(0).max(7)]).optional().default('3'),
  injuries: text(2000).optional().default(''),
  sport: text(1000).optional().default(''),
}).passthrough()

export const mindfulnessSectionSchema = z.object({
  stressLevel: text(50).optional().default(''),
  meditationExp: text(50).optional().default(''),
  techniques: text(2000).optional().default(''),
  sleepHours: z.union([z.string().trim().max(5), z.number().min(0).max(24)]).optional().default('7'),
}).passthrough()

export const goalsSectionSchema = z.object({
  shortTerm: text(3000).optional().default(''),
  mediumTerm: text(3000).optional().default(''),
  longTerm: text(3000).optional().default(''),
}).passthrough()

export const settingsSectionSchema = z.object({
  notifications: z.boolean().optional().default(true),
  theme: z.enum(['system', 'light', 'dark']).optional().default('system'),
  language: z.enum(['it', 'en']).optional().default('it'),
}).passthrough()

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord
  }
  return {}
}

function normalizeRecord<T extends JsonRecord>(
  current: unknown,
  schema: z.ZodType<T>,
): JsonRecord {
  const parsed = schema.parse(asRecord(current))
  return parsed as JsonRecord
}

export function normalizeProfileSection(
  section: Exclude<ProfileSection, 'personal'>,
  current: unknown,
): JsonRecord {
  if (section === 'health') return normalizeRecord(current, healthSectionSchema)
  if (section === 'nutrition') return normalizeRecord(current, nutritionSectionSchema)
  if (section === 'training') return normalizeRecord(current, trainingSectionSchema)
  if (section === 'mindfulness') return normalizeRecord(current, mindfulnessSectionSchema)
  if (section === 'goals') return normalizeRecord(current, goalsSectionSchema)
  return normalizeRecord(current, settingsSectionSchema)
}

export function parseProfileSectionUpdate(
  section: ProfileSection,
  data: unknown,
): JsonRecord {
  if (section === 'personal') {
    return personalSectionSchema.parse(asRecord(data)) as JsonRecord
  }
  return normalizeProfileSection(section, data)
}

export function safeParseProfileSectionUpdate(
  section: ProfileSection,
  data: unknown,
): JsonRecord {
  try {
    return parseProfileSectionUpdate(section, data)
  } catch {
    if (section === 'personal') {
      return personalSectionSchema.parse({}) as JsonRecord
    }
    return normalizeProfileSection(section, {})
  }
}

export function jsonSize(value: unknown): number {
  return JSON.stringify(value).length
}
