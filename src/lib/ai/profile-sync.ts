import type { Domain, SpecialistId } from './types'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createHash } from 'crypto'
import { safeParseProfileSectionUpdate } from '@/lib/profile/schema'

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
  specialistTurns?: Array<{ specialistId: SpecialistId; content: string }>
  syncId?: string
}

type JsonObj = Record<string, unknown>

function toPrismaJson(value: JsonObj): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

function asObj(value: unknown): JsonObj {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObj
  }
  return {}
}

function appendHistory(section: JsonObj, entry: JsonObj, syncId: string): JsonObj {
  const history = Array.isArray(section._history) ? [...section._history] : []
  if (
    history.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).syncId === syncId,
    )
  ) {
    return section
  }
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

function attachmentKey(value: Partial<AttachmentInput> & { syncId?: string }): string {
  return [
    value.syncId ?? '',
    value.type ?? '',
    value.url ?? '',
    value.fileName ?? '',
  ].join('|')
}

function buildSyncId(input: SyncInput): string {
  if (input.syncId?.trim()) return input.syncId.trim()
  return createHash('sha1')
    .update(
      JSON.stringify({
        conversationId: input.conversationId,
        userMessage: input.userMessage,
        assistantMessage: input.assistantMessage,
        domain: input.domain,
      }),
    )
    .digest('hex')
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

  const syncId = buildSyncId(input)
  const sectionKey = mapDomainToSection(input.domain)
  const health = safeParseProfileSectionUpdate('health', profile?.health)
  const nutrition = safeParseProfileSectionUpdate('nutrition', profile?.nutrition)
  const training = safeParseProfileSectionUpdate('training', profile?.training)
  const mindfulness = safeParseProfileSectionUpdate('mindfulness', profile?.mindfulness)
  const goals = safeParseProfileSectionUpdate('goals', profile?.goals)
  const settings = safeParseProfileSectionUpdate('settings', profile?.settings)
  const existingSyncLedger = Array.isArray(settings.aiSyncLedger)
    ? settings.aiSyncLedger
    : []
  if (existingSyncLedger.some((value) => value === syncId)) {
    return
  }

  const nowIso = new Date().toISOString()
  const attachmentCatalog = (input.attachments ?? []).map((att) => ({
    ...att,
    syncId,
    domain: input.domain,
    conversationId: input.conversationId,
    timestamp: nowIso,
  }))

  const historyEntry: JsonObj = {
    timestamp: nowIso,
    conversationId: input.conversationId,
    syncId,
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

  sectionUpdates[sectionKey] = appendHistory(
    sectionUpdates[sectionKey],
    historyEntry,
    syncId,
  )

  // Keep a global audit trail in settings
  const auditLog = Array.isArray(settings.aiAuditLog) ? [...settings.aiAuditLog] : []
  auditLog.push({
    timestamp: nowIso,
    syncId,
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
  const existingAttachmentKeys = new Set(
    attachmentHistory
      .filter((item): item is JsonObj => !!item && typeof item === 'object')
      .map((item) =>
        attachmentKey({
          syncId: String(item.syncId ?? ''),
          type: String(item.type ?? '') as AttachmentInput['type'],
          url: String(item.url ?? ''),
          fileName: String(item.fileName ?? ''),
        }),
      ),
  )
  for (const attachment of attachmentCatalog) {
    const key = attachmentKey(attachment)
    if (existingAttachmentKeys.has(key)) continue
    attachmentHistory.push(attachment)
    existingAttachmentKeys.add(key)
  }
  settings.attachmentHistory = attachmentHistory

  // Specialist memory separated by conversation and specialist.
  const specialistMemoryRoot = asObj(settings.aiSpecialistMemory)
  const convMemory = asObj(specialistMemoryRoot[input.conversationId])
  const memoryLedgerRoot = asObj(settings.aiSpecialistMemoryLedger)
  const convMemoryLedger = asObj(memoryLedgerRoot[input.conversationId])
  for (const turn of input.specialistTurns ?? []) {
    const existing = Array.isArray(convMemory[turn.specialistId])
      ? [...(convMemory[turn.specialistId] as string[])]
      : []
    const existingLedger = Array.isArray(convMemoryLedger[turn.specialistId])
      ? [...(convMemoryLedger[turn.specialistId] as string[])]
      : []
    if (turn.content.trim()) {
      if (!existingLedger.includes(syncId)) {
        existing.push(turn.content.trim())
        existingLedger.push(syncId)
      }
    }
    convMemory[turn.specialistId] = existing.slice(-30)
    convMemoryLedger[turn.specialistId] = existingLedger.slice(-60)
  }
  specialistMemoryRoot[input.conversationId] = convMemory
  memoryLedgerRoot[input.conversationId] = convMemoryLedger
  settings.aiSpecialistMemory = specialistMemoryRoot
  settings.aiSpecialistMemoryLedger = memoryLedgerRoot

  settings.aiSyncLedger = [...existingSyncLedger, syncId].slice(-200)

  await prisma.userProfile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      gender: normalizeGender(input.knownData.sesso),
      height: parseNumberFromMetric(input.knownData.altezza),
      weight: parseNumberFromMetric(input.knownData.peso),
      health: toPrismaJson(sectionUpdates.health),
      nutrition: toPrismaJson(sectionUpdates.nutrition),
      training: toPrismaJson(sectionUpdates.training),
      mindfulness: toPrismaJson(sectionUpdates.mindfulness),
      goals: toPrismaJson(sectionUpdates.goals),
      settings: toPrismaJson(settings),
    },
    update: {
      gender: normalizeGender(input.knownData.sesso) ?? profile?.gender ?? undefined,
      height: parseNumberFromMetric(input.knownData.altezza) ?? profile?.height ?? undefined,
      weight: parseNumberFromMetric(input.knownData.peso) ?? profile?.weight ?? undefined,
      health: toPrismaJson(sectionUpdates.health),
      nutrition: toPrismaJson(sectionUpdates.nutrition),
      training: toPrismaJson(sectionUpdates.training),
      mindfulness: toPrismaJson(sectionUpdates.mindfulness),
      goals: toPrismaJson(sectionUpdates.goals),
      settings: toPrismaJson(settings),
    },
  })
}
