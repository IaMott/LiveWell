import { getAuthUserId } from '@/lib/auth'
import { errorResponse } from '@/lib/security/errorSchema'
import { prisma } from '@/lib/prisma'

type AttributeRow = {
  domain: string
  key: string
  value: unknown
  unit: string | null
  recordedAt: Date
  notes: string | null
}

function computeAge(birthDate?: Date | null): number | null {
  if (!birthDate) return null
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1
  return age
}

function latestByDomain(rows: AttributeRow[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  const seen = new Set<string>()
  for (const row of rows) {
    const composite = `${row.domain}:${row.key}`
    if (seen.has(composite)) continue
    seen.add(composite)
    if (!out[row.domain]) out[row.domain] = {}
    out[row.domain][row.key] = {
      value: row.value,
      unit: row.unit ?? undefined,
      recordedAt: row.recordedAt.toISOString(),
      notes: row.notes ?? undefined,
    }
  }
  return out
}

export async function GET(): Promise<Response> {
  const userId = await getAuthUserId()
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const [profile, attributes] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
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
    }),
    prisma.userAttribute.findMany({
      where: {
        userId,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      orderBy: { recordedAt: 'desc' },
      take: 500,
      select: {
        domain: true,
        key: true,
        value: true,
        unit: true,
        recordedAt: true,
        notes: true,
      },
    }),
  ])

  const attrsByDomain = latestByDomain(attributes)
  const personalAttrs = attrsByDomain.personal ?? {}

  const payload = {
    personal: {
      birthDate: profile?.birthDate?.toISOString() ?? null,
      age: computeAge(profile?.birthDate ?? null),
      gender: profile?.gender ?? null,
      heightCurrent:
        (personalAttrs.height as { value?: unknown } | undefined)?.value ?? profile?.height ?? null,
      weightCurrent:
        (personalAttrs.weight as { value?: unknown } | undefined)?.value ?? profile?.weight ?? null,
    },
    sections: {
      health: {
        dynamic: attrsByDomain.health ?? {},
        legacy: (profile?.health as Record<string, unknown> | null) ?? {},
      },
      nutrition: {
        dynamic: attrsByDomain.nutrition ?? {},
        legacy: (profile?.nutrition as Record<string, unknown> | null) ?? {},
      },
      training: {
        dynamic: attrsByDomain.training ?? {},
        legacy: (profile?.training as Record<string, unknown> | null) ?? {},
      },
      mindfulness: {
        dynamic: attrsByDomain.mindfulness ?? {},
        legacy: (profile?.mindfulness as Record<string, unknown> | null) ?? {},
      },
      goals: {
        dynamic: attrsByDomain.general ?? {},
        legacy: (profile?.goals as Record<string, unknown> | null) ?? {},
      },
      settings: {
        legacy: (profile?.settings as Record<string, unknown> | null) ?? {},
      },
    },
    counts: {
      dynamicAttributes: attributes.length,
      dynamicKeysByDomain: Object.fromEntries(
        Object.entries(attrsByDomain).map(([domain, obj]) => [domain, Object.keys(obj).length]),
      ),
    },
    generatedAt: new Date().toISOString(),
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
