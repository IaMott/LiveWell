/**
 * agentProgramTracker.ts
 *
 * Layer 2 — Program tracking per specialist.
 *
 * Programs are stored in UserAttribute with domain = 'program':
 *   key: `{agentId}_start`           → ISO date string (program start)
 *   key: `{agentId}_duration_days`   → number (total program length)
 *   key: `{agentId}_checkpoint_days` → JSON array of checkpoint days (e.g. [7,14,21,30])
 *   key: `{agentId}_status`          → 'active' | 'completed' | 'extended' | 'paused'
 *   key: `{agentId}_cycle`           → number (cycle number, starts at 1, increments on extension)
 *
 * Specialists set these values via user.setAttribute tool calls at program start.
 * The `buildProgramStatusBlock()` function reads these and injects them into the agent prompt.
 */

import type { ContextPack } from '../types'

// ---------------------------------------------------------------------------
// Default program parameters per specialist
// ---------------------------------------------------------------------------

export const AGENT_PROGRAM_DEFAULTS: Record<
  string,
  { durationDays: number; checkpointDays: number[] }
> = {
  dietista: { durationDays: 30, checkpointDays: [7, 14, 21, 30] },
  chef: { durationDays: 14, checkpointDays: [7, 14] },
  endocrinologo: { durationDays: 90, checkpointDays: [30, 60, 90] },
  'persona-trainer': { durationDays: 42, checkpointDays: [7, 14, 28, 42] },
  chinesologo: { durationDays: 28, checkpointDays: [14, 28] },
  fisioterapista: { durationDays: 21, checkpointDays: [7, 14, 21] },
  fisiatra: { durationDays: 60, checkpointDays: [30, 60] },
  'medico-dello-sport': { durationDays: 30, checkpointDays: [14, 30] },
  'sleep-coach': { durationDays: 21, checkpointDays: [7, 14, 21] },
  mmg: { durationDays: 90, checkpointDays: [30, 90] },
  cardiologo: { durationDays: 90, checkpointDays: [30, 60, 90] },
  dermatologo: { durationDays: 30, checkpointDays: [14, 30] },
  gastroenterologo: { durationDays: 42, checkpointDays: [14, 28, 42] },
  psicologo: { durationDays: 90, checkpointDays: [30, 60, 90] },
  'mental-coach': { durationDays: 42, checkpointDays: [14, 28, 42] },
  'relationship-coach': { durationDays: 60, checkpointDays: [30, 60] },
  'analista-contesto': { durationDays: 14, checkpointDays: [7, 14] },
  'career-coach': { durationDays: 90, checkpointDays: [30, 60, 90] },
  'executive-coach': { durationDays: 90, checkpointDays: [30, 60, 90] },
  commercialista: { durationDays: 365, checkpointDays: [90, 180, 270, 365] },
  'consulente-legale': { durationDays: 90, checkpointDays: [30, 60, 90] },
  'financial-planner': { durationDays: 180, checkpointDays: [30, 90, 180] },
  'life-organizer': { durationDays: 42, checkpointDays: [14, 28, 42] },
}

// ---------------------------------------------------------------------------
// getProgramAttributes — reads program metadata from contextPack
// ---------------------------------------------------------------------------

type ProgramAttributes = {
  start: Date | null
  durationDays: number
  checkpointDays: number[]
  status: string
  cycle: number
}

function getProgramAttributes(agentId: string, contextPack: ContextPack): ProgramAttributes | null {
  const programAttrs = (contextPack.user.attributes as Record<string, unknown> | undefined)?.[
    'program'
  ] as Record<string, { value: unknown }> | undefined
  if (!programAttrs) return null

  const startRaw = programAttrs[`${agentId}_start`]?.value
  if (!startRaw || typeof startRaw !== 'string') return null

  const start = new Date(startRaw)
  if (isNaN(start.getTime())) return null

  const defaults = AGENT_PROGRAM_DEFAULTS[agentId] ?? { durationDays: 30, checkpointDays: [14, 30] }

  const durationRaw = programAttrs[`${agentId}_duration_days`]?.value
  const durationDays = typeof durationRaw === 'number' ? durationRaw : defaults.durationDays

  const checkpointRaw = programAttrs[`${agentId}_checkpoint_days`]?.value
  const checkpointDays = Array.isArray(checkpointRaw)
    ? (checkpointRaw as number[])
    : defaults.checkpointDays

  const statusRaw = programAttrs[`${agentId}_status`]?.value
  const status = typeof statusRaw === 'string' ? statusRaw : 'active'

  const cycleRaw = programAttrs[`${agentId}_cycle`]?.value
  const cycle = typeof cycleRaw === 'number' ? cycleRaw : 1

  return { start, durationDays, checkpointDays, status, cycle }
}

// ---------------------------------------------------------------------------
// buildProgramStatusBlock — injected into agent prompt
// ---------------------------------------------------------------------------

export function buildProgramStatusBlock(agentId: string, contextPack: ContextPack): string[] {
  const prog = getProgramAttributes(agentId, contextPack)
  const defaults = AGENT_PROGRAM_DEFAULTS[agentId]

  if (!prog) {
    // No program started yet — tell the specialist to set one up
    if (!defaults) return []
    return [
      'PROGRAMMA: non ancora avviato',
      `→ Durata standard per la tua specialità: ${defaults.durationDays} giorni`,
      `→ Checkpoint previsti: giorni ${defaults.checkpointDays.join(', ')}`,
      '→ Quando avvii un piano, usa user.setAttribute con domain:"program" per registrare:',
      `   ${agentId}_start (data ISO), ${agentId}_duration_days, ${agentId}_checkpoint_days, ${agentId}_status:"active"`,
    ]
  }

  if (!prog.start) return []
  const today = new Date()
  const dayElapsed = Math.floor((today.getTime() - prog.start.getTime()) / (1000 * 60 * 60 * 24))
  const dayRemaining = Math.max(0, prog.durationDays - dayElapsed)

  // Find next checkpoint
  const nextCheckpoint = prog.checkpointDays.find((d) => d > dayElapsed) ?? null
  const passedCheckpoints = prog.checkpointDays.filter((d) => d <= dayElapsed)
  const daysToNextCheckpoint = nextCheckpoint != null ? nextCheckpoint - dayElapsed : null

  const statusLabel =
    prog.status === 'active'
      ? '🟢 ATTIVO'
      : prog.status === 'extended'
        ? '🔵 ESTESO'
        : prog.status === 'paused'
          ? '🟡 IN PAUSA'
          : '⚪ COMPLETATO'

  const lines: string[] = [
    `PROGRAMMA ${statusLabel}${prog.cycle > 1 ? ` (ciclo ${prog.cycle})` : ''}:`,
    `→ Giorno ${dayElapsed} di ${prog.durationDays} (${dayRemaining} rimanenti)`,
  ]

  if (passedCheckpoints.length > 0) {
    lines.push(`→ Checkpoint superati: giorni ${passedCheckpoints.join(', ')}`)
  }

  if (daysToNextCheckpoint != null) {
    lines.push(
      `→ Prossimo checkpoint: giorno ${nextCheckpoint} (fra ${daysToNextCheckpoint} giorn${daysToNextCheckpoint === 1 ? 'o' : 'i'})`,
    )
  } else if (dayElapsed >= prog.durationDays) {
    lines.push('→ Programma completato — valuta se estendere o aprire un nuovo ciclo')
  }

  if (prog.status === 'active' && daysToNextCheckpoint === 0) {
    lines.push('⚠️ OGGI è un giorno di checkpoint — esegui la revisione PARTE C completa')
  }

  return lines
}
