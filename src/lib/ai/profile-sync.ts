import type { Domain, SpecialistId } from './types'
import { prisma } from '@/lib/prisma'

type AttachmentInput = {
  type: 'image' | 'barcode' | 'audio'
  url: string
  fileName: string
  barcodeValue?: string
}

type SyncInput = {
  userId: string
  conversationId: string
  userMessage: string
  assistantMessage: string
  domain: Domain
  primarySpecialist: SpecialistId
  contributors: SpecialistId[]
  knownData: Record<string, string>
  attachments?: AttachmentInput[]
}

type JsonObj = Record<string, unknown>

function asObj(value: unknown): JsonObj {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObj
  }
  return {}
}

function appendHistory(section: JsonObj, entry: JsonObj): JsonObj {
  const history = Array.isArray(section._history) ? [...section._history] : []
  history.push(entry)
  return { ...section, _history: history }
}

function normalizeGender(raw?: string): 'M' | 'F' | undefined {
  if (!raw) return undefined
  const value = raw.toLowerCase()
  if (value.includes('uomo') || value === 'm') return 'M'
  if (value.includes('donna') || value === 'f') return 'F'
  return undefined
}

function parseNumberFromMetric(raw?: string): number | undefined {
  if (!raw) return undefined
  const match = raw.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return undefined
  return Number(match[1].replace(',', '.'))
}

function mapDomainToSection(domain: Domain): 'health' | 'nutrition' | 'training' | 'mindfulness' | 'goals' {
  if (domain === 'nutrizione') return 'nutrition'
  if (domain === 'allenamento' || domain === 'riabilitazione') return 'training'
  if (domain === 'mindset') return 'mindfulness'
  if (domain === 'salute') return 'health'
  return 'goals'
}

export async function syncProfileFromConversation(input: SyncInput): Promise<void> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId: input.userId },
    select: {
      birthDate: true,
      gender: true,
      height: true,
      weight: true,
      health: true,
      nutrition: true,
      training: true,
      mindfulness: true,
      goals: true,
      settings: true,
    },
  })

  const sectionKey = mapDomainToSection(input.domain)
  const health = asObj(profile?.health)
  const nutrition = asObj(profile?.nutrition)
  const training = asObj(profile?.training)
  const mindfulness = asObj(profile?.mindfulness)
  const goals = asObj(profile?.goals)
  const settings = asObj(profile?.settings)

  const nowIso = new Date().toISOString()
  const attachmentCatalog = (input.attachments ?? []).map((att) => ({
    ...att,
    domain: input.domain,
    conversationId: input.conversationId,
    timestamp: nowIso,
  }))

  const historyEntry: JsonObj = {
    timestamp: nowIso,
    conversationId: input.conversationId,
    domain: input.domain,
    primarySpecialist: input.primarySpecialist,
    contributors: input.contributors,
    userMessage: input.userMessage,
    assistantSummary: input.assistantMessage.slice(0, 1200),
    knownData: input.knownData,
    attachments: attachmentCatalog,
  }

  const sectionUpdates: Record<string, JsonObj> = {
    health,
    nutrition,
    training,
    mindfulness,
    goals,
  }

  sectionUpdates[sectionKey] = appendHistory(sectionUpdates[sectionKey], historyEntry)

  // Keep a global audit trail in settings
  const auditLog = Array.isArray(settings.aiAuditLog) ? [...settings.aiAuditLog] : []
  auditLog.push({
    timestamp: nowIso,
    action: 'ai_profile_sync',
    domain: input.domain,
    specialist: input.primarySpecialist,
    contributors: input.contributors,
    conversationId: input.conversationId,
    updatedSection: sectionKey,
  })
  settings.aiAuditLog = auditLog

  // Attachment global catalog for cross-query
  const attachmentHistory = Array.isArray(settings.attachmentHistory)
    ? [...settings.attachmentHistory]
    : []
  attachmentHistory.push(...attachmentCatalog)
  settings.attachmentHistory = attachmentHistory

  await prisma.userProfile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      gender: normalizeGender(input.knownData.sesso),
      height: parseNumberFromMetric(input.knownData.altezza),
      weight: parseNumberFromMetric(input.knownData.peso),
      health: sectionUpdates.health,
      nutrition: sectionUpdates.nutrition,
      training: sectionUpdates.training,
      mindfulness: sectionUpdates.mindfulness,
      goals: sectionUpdates.goals,
      settings,
    },
    update: {
      gender: normalizeGender(input.knownData.sesso) ?? profile?.gender ?? undefined,
      height: parseNumberFromMetric(input.knownData.altezza) ?? profile?.height ?? undefined,
      weight: parseNumberFromMetric(input.knownData.peso) ?? profile?.weight ?? undefined,
      health: sectionUpdates.health,
      nutrition: sectionUpdates.nutrition,
      training: sectionUpdates.training,
      mindfulness: sectionUpdates.mindfulness,
      goals: sectionUpdates.goals,
      settings,
    },
  })
}
