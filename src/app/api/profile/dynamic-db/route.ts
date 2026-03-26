import { getAuthUserId } from '@/lib/auth'
import {
  computeAgeFromBirthDate,
  getDynamicFieldDescriptor,
  semanticDisplayLabel,
} from '@/lib/dynamicDb/semantics'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

function readRefId(value: unknown, key: 'fileAssetId' | 'artifactId'): string | null {
  if (!value || typeof value !== 'object') return null
  const raw = (value as Record<string, unknown>)[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({
    key: `profile-dynamic-db:${userId}:${getClientIp(request)}`,
    max: 30,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const [user, profile, attributes, files, artifacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: { birthDate: true, gender: true, height: true, weight: true, updatedAt: true },
    }),
    prisma.userAttribute.findMany({
      where: { userId },
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      take: 2000,
      select: {
        id: true,
        domain: true,
        key: true,
        value: true,
        unit: true,
        source: true,
        conversationId: true,
        recordedAt: true,
        validUntil: true,
        notes: true,
        createdAt: true,
      },
    }),
    prisma.fileAsset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        url: true,
        extractedText: true,
        conversationId: true,
        createdAt: true,
      },
    }),
    prisma.recommendationArtifact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        title: true,
        contentMarkdown: true,
        relatedConversationId: true,
        createdAt: true,
      },
    }),
  ])

  const clinicalByDomain: Record<
    string,
    Record<
      string,
      {
        current: {
          value: unknown
          unit: string | null
          source: string
          recordedAt: string
          validUntil: string | null
          notes: string | null
          semantics: string
          displayLabel: string
        }
        history: Array<{
          value: unknown
          unit: string | null
          source: string
          recordedAt: string
          validUntil: string | null
          notes: string | null
          semantics: string
          displayLabel: string
        }>
      }
    >
  > = {}

  const fileNotesById = new Map<string, string>()
  const artifactNotesById = new Map<string, string>()

  for (const a of attributes) {
    const domain = a.domain
    const key = a.key
    const descriptor = getDynamicFieldDescriptor(key)

    if (key === 'attachment_file' && a.notes) {
      const fileAssetId = readRefId(a.value, 'fileAssetId')
      if (fileAssetId && !fileNotesById.has(fileAssetId)) fileNotesById.set(fileAssetId, a.notes)
    }

    if (key === 'generated_artifact' && a.notes) {
      const artifactId = readRefId(a.value, 'artifactId')
      if (artifactId && !artifactNotesById.has(artifactId))
        artifactNotesById.set(artifactId, a.notes)
    }

    clinicalByDomain[domain] ??= {}
    clinicalByDomain[domain][key] ??= {
      current: {
        value: a.value,
        unit: a.unit,
        source: a.source,
        recordedAt: a.recordedAt.toISOString(),
        validUntil: a.validUntil?.toISOString() ?? null,
        notes: a.notes,
        semantics: descriptor.semantics,
        displayLabel: semanticDisplayLabel(key),
      },
      history: [],
    }
    clinicalByDomain[domain][key].history.push({
      value: a.value,
      unit: a.unit,
      source: a.source,
      recordedAt: a.recordedAt.toISOString(),
      validUntil: a.validUntil?.toISOString() ?? null,
      notes: a.notes,
      semantics: descriptor.semantics,
      displayLabel: semanticDisplayLabel(key),
    })
  }

  const derivedCurrentAge = computeAgeFromBirthDate(profile?.birthDate ?? null)

  return Response.json({
    exportedAt: new Date().toISOString(),
    user,
    profile: profile
      ? {
          birthDate: profile.birthDate?.toISOString() ?? null,
          gender: profile.gender,
          height: profile.height,
          weight: profile.weight,
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    dynamicDb: {
      schemaVersion: 'clinical-record-v2',
      derived: {
        ...(derivedCurrentAge != null
          ? {
              currentAge: {
                value: derivedCurrentAge,
                semantics: 'derived_temporal',
                source: 'birthDate',
                computedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
      domains: clinicalByDomain,
      attributes: attributes.map((a) => ({
        domain: a.domain,
        key: a.key,
        value: a.value,
        unit: a.unit,
        source: a.source,
        recordedAt: a.recordedAt.toISOString(),
        validUntil: a.validUntil?.toISOString() ?? null,
        notes: a.notes,
        semantics: getDynamicFieldDescriptor(a.key).semantics,
        displayLabel: semanticDisplayLabel(a.key),
      })),
      documents: {
        userFiles: files.map((f) => ({
          id: f.id,
          type: 'user_file',
          filename: f.filename,
          mimeType: f.mimeType,
          size: f.size,
          conversationId: f.conversationId,
          recordedAt: f.createdAt.toISOString(),
          notes:
            fileNotesById.get(f.id) ??
            "File caricato dall'utente; contenuto disponibile nel dynamic DB per analisi specialistica.",
          url: f.url,
          extractedTextPreview:
            f.extractedText && !f.extractedText.startsWith('data:')
              ? f.extractedText.slice(0, 500)
              : null,
        })),
        generatedArtifacts: artifacts.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          conversationId: a.relatedConversationId,
          recordedAt: a.createdAt.toISOString(),
          notes:
            artifactNotesById.get(a.id) ??
            `Artifact generato dal sistema multi-agente: ${a.title}.`,
          preview: a.contentMarkdown.slice(0, 500),
          contentMarkdown: a.contentMarkdown,
          downloadFilename: `${a.title.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'artifact'}.md`,
        })),
      },
    },
  })
}
