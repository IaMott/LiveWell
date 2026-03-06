import type { Role } from '@/lib/ai/runtime-types'
import type { ToolName } from './toolRegistry'

type AuthorizationInput = {
  role: Role
  toolName: ToolName
  destructive: boolean
  requiresOwnerMode: boolean
  ownerModeEnabled: boolean
}

type AuthorizationResult =
  | { ok: true }
  | { ok: false; code: 'FORBIDDEN' | 'OWNER_MODE_REQUIRED'; reason: string }

const USER_ALLOWED_TOOLS = new Set<ToolName>([
  'user.updateProfile',
  'health.addMetric',
  'nutrition.logMeal',
  'nutrition.createFoodItem',
  'training.logWorkoutSession',
  'mindfulness.createEntry',
  'artifacts.saveRecommendation',
  'share.createLink',
  'export.pdf',
])

const ADMIN_ALLOWED_TOOLS = new Set<ToolName>([
  ...USER_ALLOWED_TOOLS,
  'nutrition.recipes.createRecipe',
  'training.createWorkoutPlan',
  'notifications.createInApp',
])

export function authorizeToolExecution(input: AuthorizationInput): AuthorizationResult {
  const { role, toolName, destructive, requiresOwnerMode, ownerModeEnabled } = input

  if (destructive || requiresOwnerMode) {
    if (role !== 'OWNER') {
      return {
        ok: false,
        code: 'FORBIDDEN',
        reason: 'Only OWNER can execute destructive tools',
      }
    }
    if (!ownerModeEnabled) {
      return {
        ok: false,
        code: 'OWNER_MODE_REQUIRED',
        reason: 'Owner mode must be enabled for this tool',
      }
    }
  }

  if (role === 'OWNER') return { ok: true }

  if (role === 'ADMIN') {
    return ADMIN_ALLOWED_TOOLS.has(toolName)
      ? { ok: true }
      : { ok: false, code: 'FORBIDDEN', reason: 'Tool not allowed for ADMIN' }
  }

  return USER_ALLOWED_TOOLS.has(toolName)
    ? { ok: true }
    : { ok: false, code: 'FORBIDDEN', reason: 'Tool not allowed for USER' }
}
