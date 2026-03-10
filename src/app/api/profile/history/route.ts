import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeParseProfileSectionUpdate } from '@/lib/profile/schema'

const sectionSchema = z.enum([
  'all',
  'health',
  'nutrition',
  'training',
  'mindfulness',
  'goals',
])

const querySchema = z.object({
  section: sectionSchema.optional().default('all'),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

type HistorySection = Exclude<z.infer<typeof sectionSchema>, 'all'>
type JsonRecord = Record<string, unknown>

type HistoryEntry = {
  id: string
  section: HistorySection
  timestamp: string
  domain: string
  primarySpecialist: string
  contributors: string[]
  userMessage: string
  assistantSummary: string
  knownData: Record<string, string>
  attachments: JsonRecord[]
}

const HISTORY_SECTIONS: HistorySection[] = [
  'health',
  'nutrition',
  'training',
  'mindfulness',
  'goals',
]

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord
  }
  return {}
}

function asRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is JsonRecord => !!item && typeof item === 'object')
}

function normalizeHistoryEntries(section: HistorySection, sectionData: unknown): HistoryEntry[] {
  const parsed = safeParseProfileSectionUpdate(section, sectionData)
  const history = asRecordArray(parsed._history)

  return history
    .map((entry, index) => {
      const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : new Date(0).toISOString()
      const syncId = typeof entry.syncId === 'string' ? entry.syncId : `${section}-${index}`
      return {
        id: `${section}-${syncId}-${index}`,
        section,
        timestamp,
        domain: typeof entry.domain === 'string' ? entry.domain : 'generale',
        primarySpecialist:
          typeof entry.primarySpecialist === 'string'
            ? entry.primarySpecialist
            : 'intervistatore',
        contributors: Array.isArray(entry.contributors)
          ? entry.contributors.filter((v): v is string => typeof v === 'string')
          : [],
        userMessage: typeof entry.userMessage === 'string' ? entry.userMessage : '',
        assistantSummary:
          typeof entry.assistantSummary === 'string' ? entry.assistantSummary : '',
        knownData: asRecord(entry.knownData) as Record<string, string>,
        attachments: asRecordArray(entry.attachments),
      }
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsedQuery = querySchema.safeParse({
    section: url.searchParams.get('section') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Query non valida' }, { status: 400 })
  }

  const { section, limit } = parsedQuery.data

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      health: true,
      nutrition: true,
      training: true,
      mindfulness: true,
      goals: true,
      settings: true,
    },
  })

  if (!profile) {
    return NextResponse.json({
      timeline: [],
      sectionHistory: {},
      attachmentsBySection: {},
    })
  }

  const selectedSections =
    section === 'all' ? HISTORY_SECTIONS : ([section] as HistorySection[])

  const sectionHistory: Partial<Record<HistorySection, HistoryEntry[]>> = {}
  const timeline: HistoryEntry[] = []

  for (const sectionKey of selectedSections) {
    const entries = normalizeHistoryEntries(sectionKey, profile[sectionKey])
    sectionHistory[sectionKey] = entries.slice(0, limit)
    timeline.push(...entries)
  }

  timeline.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const settings = safeParseProfileSectionUpdate('settings', profile.settings)
  const attachmentBySection = asRecord(settings.attachmentBySection)

  const attachmentsBySection = selectedSections.reduce(
    (acc, sectionKey) => {
      acc[sectionKey] = asRecordArray(attachmentBySection[sectionKey]).slice(-limit)
      return acc
    },
    {} as Record<HistorySection, JsonRecord[]>,
  )

  return NextResponse.json({
    timeline: timeline.slice(0, limit),
    sectionHistory,
    attachmentsBySection,
  })
}
