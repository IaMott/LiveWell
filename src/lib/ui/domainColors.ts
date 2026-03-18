/**
 * C1: Single source of truth for domain colors.
 * Imported by ChatShell, ChatInput, MessageBubble, and any future component.
 *
 * Color choices:
 *   nutrition   → #AF52DE (purple — aligned with Apple Health food icon)
 *   training    → #007AFF (blue — activity)
 *   health      → #34C759 (green — vitality)
 *   mindfulness → #5AC8FA (cyan — calm)
 *   inspiration → #FF9F0A (orange — creativity)
 *   general     → #8E8E93 (grey — neutral)
 *   coordination→ #8E8E93 (grey — system-level)
 */
import type { Domain } from '@/lib/ai/types'

export const DOMAIN_COLORS: Record<Domain, string> = {
  nutrition: '#AF52DE',
  training: '#007AFF',
  health: '#34C759',
  mindfulness: '#5AC8FA',
  inspiration: '#FF9F0A',
  general: '#8E8E93',
  coordination: '#8E8E93',
}

export function getDomainColor(domain: Domain | string | null | undefined): string {
  if (!domain) return '#007AFF'
  return DOMAIN_COLORS[domain as Domain] ?? '#007AFF'
}
