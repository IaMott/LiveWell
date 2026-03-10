import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type LogApiErrorInput = {
  endpoint: '/api/chat/send' | '/api/live-token'
  errorCode: string
  statusCode: number
  message?: string
  requestId?: string
  userId?: string | null
  metadata?: Record<string, unknown>
}

export async function logApiErrorEvent(input: LogApiErrorInput): Promise<void> {
  try {
    await prisma.apiErrorEvent.create({
      data: {
        endpoint: input.endpoint,
        errorCode: input.errorCode,
        statusCode: input.statusCode,
        message: input.message ?? null,
        requestId: input.requestId ?? null,
        userId: input.userId ?? null,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch {
    // Monitoring must never break request flow.
  }
}

export async function getApiErrorDashboard(params?: { hours?: number; take?: number }) {
  const hours = params?.hours ?? 24
  const take = params?.take ?? 50
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [rows, byEndpoint, byErrorCode, byStatus] = await Promise.all([
    prisma.apiErrorEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        endpoint: true,
        errorCode: true,
        statusCode: true,
        message: true,
        requestId: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.apiErrorEvent.groupBy({
      by: ['endpoint'],
      where: { createdAt: { gte: since } },
      _count: { endpoint: true },
      orderBy: { _count: { endpoint: 'desc' } },
    }),
    prisma.apiErrorEvent.groupBy({
      by: ['errorCode'],
      where: { createdAt: { gte: since } },
      _count: { errorCode: true },
      orderBy: { _count: { errorCode: 'desc' } },
    }),
    prisma.apiErrorEvent.groupBy({
      by: ['statusCode'],
      where: { createdAt: { gte: since } },
      _count: { statusCode: true },
      orderBy: { _count: { statusCode: 'desc' } },
    }),
  ])

  return {
    windowHours: hours,
    totals: {
      errors: rows.length,
      byEndpoint: byEndpoint.map((r) => ({ endpoint: r.endpoint, count: r._count.endpoint })),
      byErrorCode: byErrorCode.map((r) => ({ errorCode: r.errorCode, count: r._count.errorCode })),
      byStatus: byStatus.map((r) => ({ statusCode: r.statusCode, count: r._count.statusCode })),
    },
    recent: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}
