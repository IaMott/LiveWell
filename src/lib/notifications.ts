import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface CreateNotificationParams {
  userId: string
  type: 'specialist' | 'reminder' | 'milestone' | 'system'
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  })
}

/**
 * Extracts actionable items from assistant response to generate notifications.
 * Returns a notification if the response contains recommendations, plans, or follow-ups.
 */
export function shouldNotify(
  response: string,
  specialistId?: string,
): { title: string; message: string } | null {
  const lower = response.toLowerCase()

  // Check for actionable patterns in Italian
  const patterns = [
    { regex: /ti consiglio di|ti raccomando|dovresti/i, title: 'Nuovo consiglio' },
    { regex: /piano .{0,20}(settimanal|giornal|alimentar|allenam)/i, title: 'Piano proposto' },
    { regex: /ricordati di|non dimenticare/i, title: 'Promemoria' },
    { regex: /obiettivo|traguardo/i, title: 'Aggiornamento obiettivi' },
    { regex: /attenzione|importante|urgente/i, title: 'Avviso importante' },
  ]

  for (const { regex, title } of patterns) {
    if (regex.test(lower)) {
      // Extract a short preview from the response
      const preview = response.slice(0, 120).replace(/\n/g, ' ').trim()
      const suffix = response.length > 120 ? '...' : ''
      return {
        title: specialistId ? `${title} dallo specialista` : title,
        message: preview + suffix,
      }
    }
  }

  return null
}
