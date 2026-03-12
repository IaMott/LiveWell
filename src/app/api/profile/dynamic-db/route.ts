import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({
    key: `profile-dynamic-db:${userId}:${getClientIp(request)}`,
    max: 30,
  })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  const [user, profile, attributes] = await Promise.all([
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
        }
        history: Array<{
          value: unknown
          unit: string | null
          source: string
          recordedAt: string
          validUntil: string | null
          notes: string | null
        }>
      }
    >
  > = {}

  for (const a of attributes) {
    const domain = a.domain
    const key = a.key
    clinicalByDomain[domain] ??= {}
    clinicalByDomain[domain][key] ??= {
      current: {
        value: a.value,
        unit: a.unit,
        source: a.source,
        recordedAt: a.recordedAt.toISOString(),
        validUntil: a.validUntil?.toISOString() ?? null,
        notes: a.notes,
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
    })
  }

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
      schemaVersion: 'clinical-record-v1',
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
      })),
    },
  })
}
