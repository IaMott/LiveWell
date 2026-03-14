import { z } from 'zod'

export const ALLOWED_TOOL_NAMES = [
  'user.updateProfile',
  'user.setAttribute',
  'health.addMetric',
  'health.logBodyComposition',
  'health.logBloodwork',
  'health.logDiagnosis',
  'health.updateMedications',
  'nutrition.logMeal',
  'nutrition.createFoodItem',
  'nutrition.recipes.createRecipe',
  'nutrition.logWater',
  'nutrition.setCalorieGoal',
  'training.createWorkoutPlan',
  'training.logWorkoutSession',
  'training.logInjury',
  'training.updatePlan',
  'mindfulness.createEntry',
  'artifacts.saveRecommendation',
  'notifications.createInApp',
  'share.createLink',
  'export.pdf',
  'geo.setPreference',
  'geo.updateCoarseLocation',
  'geo.clearLocation',
  'appointment.schedule',
  'appointment.cancel',
  'reminder.create',
] as const

export type ToolName = (typeof ALLOWED_TOOL_NAMES)[number]

const baseString = z.string().trim().min(1)

const userUpdateProfileSchema = z.object({
  fields: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0),
})

const userSetAttributeSchema = z.object({
  domain: z.enum(['health', 'nutrition', 'training', 'mindfulness', 'personal', 'general']),
  key: baseString.max(64),
  value: z.unknown(),
  unit: z.string().trim().max(32).optional(),
  recordedAt: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
})

const healthAddMetricSchema = z.object({
  metricType: baseString.max(64),
  value: z.number(),
  unit: baseString.max(32).optional(),
  recordedAt: z.string().datetime().optional(),
})

const nutritionLogMealSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z
    .array(
      z.object({
        name: baseString.max(120),
        quantity: z.number().positive(),
        unit: baseString.max(16).optional(),
      }),
    )
    .min(1),
  consumedAt: z.string().datetime().optional(),
})

const nutritionCreateFoodItemSchema = z.object({
  name: baseString.max(120),
  kcalPer100g: z.number().min(0).max(2000),
  proteinPer100g: z.number().min(0).max(100).optional(),
  carbsPer100g: z.number().min(0).max(100).optional(),
  fatsPer100g: z.number().min(0).max(100).optional(),
})

const recipeSchema = z.object({
  title: baseString.max(200),
  servings: z.number().int().positive(),
  ingredients: z.array(baseString.max(200)).min(1),
  steps: z.array(baseString.max(500)).min(1),
})

const workoutPlanSchema = z.object({
  title: baseString.max(200),
  weeklyDays: z.number().int().min(1).max(7),
  sessions: z
    .array(
      z.object({
        day: baseString.max(20),
        focus: baseString.max(120),
        durationMin: z.number().int().min(5).max(300),
      }),
    )
    .min(1),
})

const workoutSessionSchema = z.object({
  planId: baseString.max(64).optional(),
  durationMin: z.number().int().min(1).max(480),
  perceivedEffort: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
})

const mindfulnessEntrySchema = z.object({
  mood: z.number().int().min(1).max(10).optional(),
  stress: z.number().int().min(1).max(10).optional(),
  content: z.string().max(4000).optional(),
})

const artifactSchema = z.object({
  type: z.enum(['nutrition', 'training', 'mindfulness', 'other']),
  title: baseString.max(200),
  contentMarkdown: z.string().min(1),
})

const createInAppNotificationSchema = z.object({
  title: baseString.max(180),
  message: z.string().trim().min(1).max(2000),
  category: z.enum(['reminder', 'professional', 'system']).default('professional'),
})

const shareCreateLinkSchema = z.object({
  resourceType: z.enum(['nutrition_plan', 'recipe', 'grocery_list', 'workout_plan']),
  resourceId: baseString.max(128),
  expiresAt: z.string().datetime().optional(),
})

const exportPdfSchema = z.object({
  resourceType: z.enum(['nutrition_plan', 'recipe', 'grocery_list', 'workout_plan']),
  resourceId: baseString.max(128),
})

const geoSetPreferenceSchema = z.object({
  enabled: z.boolean(),
})

const geoUpdateCoarseLocationSchema = z.object({
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  accuracy: z.string().max(50).optional(),
})

const geoClearLocationSchema = z.object({})

const appointmentScheduleSchema = z.object({
  title: baseString.max(200),
  scheduledAt: z.string().datetime(),
  durationMin: z.number().int().min(5).max(480).optional(),
  specialist: z.string().max(64).optional(),
  location: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
})

const appointmentCancelSchema = z.object({
  appointmentId: baseString.max(128),
  reason: z.string().max(500).optional(),
})

const reminderCreateSchema = z.object({
  title: baseString.max(200),
  message: z.string().trim().min(1).max(1000),
  remindAt: z.string().datetime(),
  appointmentId: z.string().max(128).optional(),
  repeat: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
})

// ── New specialised clinical tools ──────────────────────────────────────────

const healthLogBodyCompositionSchema = z.object({
  bodyFatPct: z.number().min(1).max(70).optional(),
  leanMassKg: z.number().min(10).max(200).optional(),
  waistCm: z.number().min(30).max(200).optional(),
  bmi: z.number().min(10).max(70).optional(),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
})

const healthLogBloodworkSchema = z.object({
  testDate: z.string().datetime().optional(),
  values: z.object({
    HbA1c: z.number().min(0).max(30).optional(),
    glucose: z.number().min(0).max(1000).optional(),
    totalCholesterol: z.number().min(0).max(2000).optional(),
    HDL: z.number().min(0).max(500).optional(),
    LDL: z.number().min(0).max(1000).optional(),
    triglycerides: z.number().min(0).max(5000).optional(),
    TSH: z.number().min(0).max(100).optional(),
    ferritin: z.number().min(0).max(10000).optional(),
    vitaminD: z.number().min(0).max(500).optional(),
    hemoglobin: z.number().min(0).max(30).optional(),
  }),
  notes: z.string().max(500).optional(),
})

const healthLogDiagnosisSchema = z.object({
  condition: baseString.max(200),
  diagnosedAt: z.string().datetime().optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  status: z.enum(['active', 'resolved', 'managed']).default('active'),
  notes: z.string().max(500).optional(),
})

const healthUpdateMedicationsSchema = z.object({
  medications: z
    .array(
      z.object({
        name: baseString.max(120),
        dosage: z.string().max(64).optional(),
        frequency: z.string().max(64).optional(),
        since: z.string().datetime().optional(),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1),
})

const nutritionLogWaterSchema = z.object({
  amountMl: z.number().int().min(50).max(10000),
  date: z.string().datetime().optional(),
})

const nutritionSetCalorieGoalSchema = z.object({
  targetKcal: z.number().int().min(500).max(10000),
  proteinPct: z.number().min(5).max(80).optional(),
  carbsPct: z.number().min(5).max(80).optional(),
  fatPct: z.number().min(5).max(80).optional(),
  notes: z.string().max(300).optional(),
})

const trainingLogInjurySchema = z.object({
  location: baseString.max(120),
  severity: z.number().int().min(1).max(5),
  type: z.enum(['muscle', 'joint', 'bone', 'tendon', 'other']).optional(),
  since: z.string().datetime().optional(),
  status: z.enum(['active', 'recovering', 'healed']).default('active'),
  notes: z.string().max(500).optional(),
})

const trainingUpdatePlanSchema = z.object({
  sessions: z
    .array(
      z.object({
        day: baseString.max(20),
        type: baseString.max(80),
        durationMin: z.number().int().min(5).max(300),
        intensity: z.enum(['low', 'moderate', 'high', 'very_high']).optional(),
      }),
    )
    .min(1),
  goal: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

export type ToolDefinition = {
  name: ToolName
  schema: z.ZodTypeAny
  mutation: boolean
  destructive: boolean
  requiresOwnerMode: boolean
  /** Semantic versioning — bump minor for backward-compatible additions, major for breaking changes */
  version: string
  deprecated?: boolean
  deprecationMessage?: string
  /** ISO date string when this tool was introduced */
  since?: string
}

const definitions: Record<ToolName, ToolDefinition> = {
  'user.updateProfile': {
    name: 'user.updateProfile',
    schema: userUpdateProfileSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'user.setAttribute': {
    name: 'user.setAttribute',
    schema: userSetAttributeSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'health.addMetric': {
    name: 'health.addMetric',
    schema: healthAddMetricSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'nutrition.logMeal': {
    name: 'nutrition.logMeal',
    schema: nutritionLogMealSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'nutrition.createFoodItem': {
    name: 'nutrition.createFoodItem',
    schema: nutritionCreateFoodItemSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'nutrition.recipes.createRecipe': {
    name: 'nutrition.recipes.createRecipe',
    schema: recipeSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'training.createWorkoutPlan': {
    name: 'training.createWorkoutPlan',
    schema: workoutPlanSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'training.logWorkoutSession': {
    name: 'training.logWorkoutSession',
    schema: workoutSessionSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'mindfulness.createEntry': {
    name: 'mindfulness.createEntry',
    schema: mindfulnessEntrySchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'artifacts.saveRecommendation': {
    name: 'artifacts.saveRecommendation',
    schema: artifactSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'notifications.createInApp': {
    name: 'notifications.createInApp',
    schema: createInAppNotificationSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'share.createLink': {
    name: 'share.createLink',
    schema: shareCreateLinkSchema,
    mutation: true,
    destructive: true,
    requiresOwnerMode: true,
    version: '1.1.0',
    since: '2025-01-01',
  },
  'export.pdf': {
    name: 'export.pdf',
    schema: exportPdfSchema,
    mutation: false,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.1.0',
    since: '2025-01-01',
  },
  'geo.setPreference': {
    name: 'geo.setPreference',
    schema: geoSetPreferenceSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'geo.updateCoarseLocation': {
    name: 'geo.updateCoarseLocation',
    schema: geoUpdateCoarseLocationSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'geo.clearLocation': {
    name: 'geo.clearLocation',
    schema: geoClearLocationSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2025-01-01',
  },
  'health.logBodyComposition': {
    name: 'health.logBodyComposition',
    schema: healthLogBodyCompositionSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'health.logBloodwork': {
    name: 'health.logBloodwork',
    schema: healthLogBloodworkSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'health.logDiagnosis': {
    name: 'health.logDiagnosis',
    schema: healthLogDiagnosisSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'health.updateMedications': {
    name: 'health.updateMedications',
    schema: healthUpdateMedicationsSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'nutrition.logWater': {
    name: 'nutrition.logWater',
    schema: nutritionLogWaterSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'nutrition.setCalorieGoal': {
    name: 'nutrition.setCalorieGoal',
    schema: nutritionSetCalorieGoalSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'training.logInjury': {
    name: 'training.logInjury',
    schema: trainingLogInjurySchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'training.updatePlan': {
    name: 'training.updatePlan',
    schema: trainingUpdatePlanSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'appointment.schedule': {
    name: 'appointment.schedule',
    schema: appointmentScheduleSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'appointment.cancel': {
    name: 'appointment.cancel',
    schema: appointmentCancelSchema,
    mutation: true,
    destructive: true,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
  'reminder.create': {
    name: 'reminder.create',
    schema: reminderCreateSchema,
    mutation: true,
    destructive: false,
    requiresOwnerMode: false,
    version: '1.0.0',
    since: '2026-03-14',
  },
}

export function isAllowedToolName(name: string): name is ToolName {
  return (ALLOWED_TOOL_NAMES as readonly string[]).includes(name)
}

export function getToolDefinition(name: string): ToolDefinition | null {
  if (!isAllowedToolName(name)) return null
  return definitions[name]
}

export function getToolVersion(name: string): string | null {
  return getToolDefinition(name)?.version ?? null
}

export function isToolDeprecated(name: string): boolean {
  return getToolDefinition(name)?.deprecated ?? false
}

/** Returns all active (non-deprecated) tool definitions */
export function getActiveToolDefinitions(): ToolDefinition[] {
  return Object.values(definitions).filter((d) => !d.deprecated)
}

export { appointmentScheduleSchema, appointmentCancelSchema, reminderCreateSchema }
