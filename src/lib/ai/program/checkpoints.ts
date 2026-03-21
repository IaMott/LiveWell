/**
 * checkpoints.ts — Layer 3: Proactive checkpoint notifications
 *
 * Called at the start of each chat request (non-blocking fire-and-forget).
 * For each active program of the user:
 *   1. Reads UserAttribute where domain = 'program'
 *   2. Computes days elapsed since program start
 *   3. If a checkpoint day has been reached and not yet notified → creates a Notification
 *   4. Marks the checkpoint as notified via a UserAttribute update
 *
 * Notification type: 'specialist' (maps to professional category in the UI)
 * Notification metadata: { specialistId, programDay, checkpointDay }
 *
 * The notification prompts the user to open a follow-up session with the specialist.
 */

import { prisma } from '@/lib/prisma'
import { AGENT_PROGRAM_DEFAULTS } from '../orchestrator/agentProgramTracker'

type PrismaClient = typeof prisma

// ---------------------------------------------------------------------------
// Specialist display names for notification messages
// ---------------------------------------------------------------------------

const SPECIALIST_DISPLAY_NAMES: Record<string, string> = {
  dietista: 'Dietista',
  chef: 'Chef',
  endocrinologo: 'Endocrinologo',
  'persona-trainer': 'Personal Trainer',
  chinesologo: 'Chinesologo',
  fisioterapista: 'Fisioterapista',
  fisiatra: 'Fisiatra',
  'medico-dello-sport': 'Medico dello Sport',
  'sleep-coach': 'Coach del Sonno',
  mmg: 'Medico di Base',
  cardiologo: 'Cardiologo',
  dermatologo: 'Dermatologo',
  gastroenterologo: 'Gastroenterologo',
  psicologo: 'Psicologo',
  'mental-coach': 'Mental Coach',
  'relationship-coach': 'Coach Relazionale',
  'analista-contesto': 'Analista di Contesto',
  'career-coach': 'Career Coach',
  'executive-coach': 'Executive Coach',
  commercialista: 'Commercialista',
  'consulente-legale': 'Consulente Legale',
  'financial-planner': 'Financial Planner',
  'life-organizer': 'Life Organizer',
}

// ---------------------------------------------------------------------------
// Checkpoint messages by day tier
// ---------------------------------------------------------------------------

function buildCheckpointMessage(
  agentId: string,
  dayElapsed: number,
  checkpointDay: number,
): {
  title: string
  message: string
} {
  const name = SPECIALIST_DISPLAY_NAMES[agentId] ?? agentId
  const defaults = AGENT_PROGRAM_DEFAULTS[agentId]
  const totalDays = defaults?.durationDays ?? 30
  const isLast = checkpointDay >= totalDays

  if (isLast) {
    return {
      title: `Revisione finale con il tuo ${name}`,
      message: `Hai completato il programma di ${totalDays} giorni con il ${name}! È il momento della revisione finale: valuta i progressi, i risultati raggiunti e decidi i prossimi passi.`,
    }
  }

  const pct = Math.round((checkpointDay / totalDays) * 100)

  if (pct <= 33) {
    return {
      title: `Check-in iniziale con il tuo ${name}`,
      message: `Sei al giorno ${dayElapsed} del programma con il ${name}. Come stai seguendo il piano? È il momento per un check-in: riporta i tuoi progressi e aggiorna i dati.`,
    }
  }

  if (pct <= 66) {
    return {
      title: `Metà percorso con il tuo ${name}`,
      message: `Sei a metà del tuo percorso con il ${name}! È il momento giusto per una revisione approfondita: analizza i progressi, verifica l'aderenza al piano e adatta gli obiettivi.`,
    }
  }

  return {
    title: `Fase avanzata: check-in con il tuo ${name}`,
    message: `Stai entrando nella fase finale del programma con il ${name}. Fai il punto della situazione e prepara il piano per i prossimi passi.`,
  }
}

// ---------------------------------------------------------------------------
// checkAndCreateCheckpointNotifications — main entry point
// ---------------------------------------------------------------------------

export async function checkAndCreateCheckpointNotifications(
  userId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  try {
    // Read all 'program' domain attributes for this user
    const programAttrs = await db.userAttribute.findMany({
      where: { userId, domain: 'program' },
      orderBy: { recordedAt: 'desc' },
    })

    if (programAttrs.length === 0) return

    // Group by agentId prefix
    const agentIds = new Set<string>()
    for (const attr of programAttrs) {
      const match = attr.key.match(
        /^(.+)_(start|duration_days|checkpoint_days|status|cycle|last_notified_day)$/,
      )
      if (match) agentIds.add(match[1])
    }

    const today = new Date()

    for (const agentId of agentIds) {
      const get = (key: string) => programAttrs.find((a) => a.key === `${agentId}_${key}`)?.value

      const startRaw = get('start')
      const statusRaw = get('status')

      // Skip if no start date or not active
      if (!startRaw || typeof startRaw !== 'string') continue
      if (statusRaw === 'completed' || statusRaw === 'paused') continue

      const start = new Date(startRaw)
      if (isNaN(start.getTime())) continue

      const dayElapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

      // Checkpoint days
      const defaults = AGENT_PROGRAM_DEFAULTS[agentId] ?? {
        durationDays: 30,
        checkpointDays: [14, 30],
      }
      const checkpointRaw = get('checkpoint_days')
      const checkpointDays: number[] = Array.isArray(checkpointRaw)
        ? (checkpointRaw as number[])
        : defaults.checkpointDays

      // Last notified checkpoint day
      const lastNotifiedRaw = get('last_notified_day')
      const lastNotifiedDay = typeof lastNotifiedRaw === 'number' ? lastNotifiedRaw : 0

      // Find checkpoint days that have been reached and not yet notified
      const dueCheckpoints = checkpointDays.filter((d) => d <= dayElapsed && d > lastNotifiedDay)

      if (dueCheckpoints.length === 0) continue

      // Take the highest due checkpoint
      const targetCheckpoint = Math.max(...dueCheckpoints)
      const { title, message } = buildCheckpointMessage(agentId, dayElapsed, targetCheckpoint)

      // Create notification
      await db.notification.create({
        data: {
          userId,
          type: 'specialist',
          title,
          message,
          metadata: {
            specialistId: agentId,
            programDay: dayElapsed,
            checkpointDay: targetCheckpoint,
            actionUrl: '/chat',
          },
        },
      })

      // Mark checkpoint as notified — upsert the last_notified_day attribute
      const existingAttr = programAttrs.find((a) => a.key === `${agentId}_last_notified_day`)
      if (existingAttr) {
        await db.userAttribute.update({
          where: { id: existingAttr.id },
          data: { value: targetCheckpoint, recordedAt: today },
        })
      } else {
        await db.userAttribute.create({
          data: {
            userId,
            domain: 'program',
            key: `${agentId}_last_notified_day`,
            value: targetCheckpoint,
            source: 'system',
          },
        })
      }
    }
  } catch (err) {
    // Non-blocking — log but don't throw
    console.error('[checkpoints] Failed to create checkpoint notifications:', err)
  }
}
