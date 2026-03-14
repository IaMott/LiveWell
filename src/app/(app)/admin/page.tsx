/**
 * /admin — Observability dashboard (ADMIN/OWNER only)
 * Mostra metriche aggregate: errori, performance agenti, moderation log, feedback.
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

async function getMetrics() {
  const now = new Date()
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    errorCount7d,
    errorByCode,
    avgConfidence,
    topAgents,
    moderationCount7d,
    moderationByType,
    feedbackAvg,
    totalUsers,
    totalConvos,
  ] = await Promise.all([
    // Errori ultimi 7 giorni
    prisma.apiErrorEvent.count({ where: { createdAt: { gte: last7d } } }),

    // Errori per codice (top 5)
    prisma.apiErrorEvent.groupBy({
      by: ['errorCode'],
      _count: { id: true },
      where: { createdAt: { gte: last30d } },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),

    // Confidence media agenti
    prisma.agentPerformanceLog.aggregate({
      _avg: { confidence: true },
      where: { createdAt: { gte: last30d } },
    }),

    // Top agenti per conteggio (ultimi 30gg)
    prisma.agentPerformanceLog.groupBy({
      by: ['agentId'],
      _count: { id: true },
      _avg: { confidence: true },
      where: { createdAt: { gte: last30d } },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),

    // Moderazioni ultimi 7 giorni
    prisma.moderationLog.count({ where: { createdAt: { gte: last7d } } }),

    // Moderazioni per tipo
    prisma.moderationLog.groupBy({
      by: ['flagType', 'severity'],
      _count: { id: true },
      where: { createdAt: { gte: last30d } },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Feedback medio globale
    prisma.userFeedback.aggregate({
      _avg: { rating: true },
      _count: { id: true },
      where: { createdAt: { gte: last30d } },
    }),

    // Utenti totali
    prisma.user.count(),

    // Conversazioni totali
    prisma.conversation.count({ where: { deletedAt: null } }),
  ])

  return {
    errorCount7d,
    errorByCode,
    avgConfidence: avgConfidence._avg.confidence,
    topAgents,
    moderationCount7d,
    moderationByType,
    feedbackAvg: feedbackAvg._avg.rating,
    feedbackCount: feedbackAvg._count.id,
    totalUsers,
    totalConvos,
  }
}

function StatCard({
  label,
  value,
  sub,
  color = 'gray',
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'gray' | 'green' | 'red' | 'blue' | 'yellow'
}) {
  const colors = {
    gray: 'border-gray-200 bg-white',
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
    blue: 'border-blue-200 bg-blue-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const role = (session.user as unknown as Record<string, unknown>).role as string | undefined
  if (role !== 'ADMIN' && role !== 'OWNER') {
    redirect('/')
  }

  const m = await getMetrics()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Observability Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Metriche operative di LiveWell — ultimi 7/30 giorni
        </p>
      </div>

      {/* Top stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Utenti totali" value={m.totalUsers} color="blue" />
        <StatCard label="Conversazioni attive" value={m.totalConvos} color="green" />
        <StatCard
          label="Confidence media agenti"
          value={m.avgConfidence ? `${(m.avgConfidence * 100).toFixed(1)}%` : '—'}
          sub="ultimi 30 giorni"
          color="green"
        />
        <StatCard
          label="Errori API (7gg)"
          value={m.errorCount7d}
          color={m.errorCount7d > 50 ? 'red' : 'gray'}
        />
        <StatCard
          label="Feedback medio"
          value={m.feedbackAvg ? `${m.feedbackAvg.toFixed(1)}/5` : '—'}
          sub={`${m.feedbackCount} rating`}
          color={
            m.feedbackAvg && m.feedbackAvg >= 4
              ? 'green'
              : m.feedbackAvg && m.feedbackAvg < 3
                ? 'red'
                : 'gray'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Agent performance */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Performance Agenti (30gg)</h2>
          {m.topAgents.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun dato</p>
          ) : (
            <div className="space-y-3">
              {m.topAgents.map((a) => {
                const conf = a._avg.confidence ?? 0
                const pct = Math.round(conf * 100)
                return (
                  <div key={a.agentId} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium text-gray-700 truncate">
                      {a.agentId}
                    </span>
                    <div className="flex-1 rounded-full bg-gray-100 h-2">
                      <div
                        className={`h-2 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-gray-500">{pct}%</span>
                    <span className="w-10 text-right text-xs text-gray-400">{a._count.id}x</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Error codes */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Errori per codice (30gg)</h2>
          {m.errorByCode.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun errore registrato</p>
          ) : (
            <div className="space-y-2">
              {m.errorByCode.map((e) => (
                <div key={e.errorCode} className="flex items-center justify-between">
                  <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-mono text-red-700">
                    {e.errorCode}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{e._count.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Moderation log */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">
            Content Moderation (30gg)
            {m.moderationCount7d > 0 && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                {m.moderationCount7d} ultimi 7gg
              </span>
            )}
          </h2>
          {m.moderationByType.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun flag</p>
          ) : (
            <div className="space-y-2">
              {m.moderationByType.map((mod) => {
                const key = `${mod.flagType}:${mod.severity}`
                const colors: Record<string, string> = {
                  high: 'bg-red-100 text-red-700',
                  medium: 'bg-orange-100 text-orange-700',
                  low: 'bg-yellow-100 text-yellow-700',
                }
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[mod.severity] ?? ''}`}
                      >
                        {mod.severity}
                      </span>
                      <span className="text-sm text-gray-700">{mod.flagType}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{mod._count.id}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Azioni</h2>
          <div className="space-y-3">
            <a
              href="/api/admin/retention"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span>📋 Retention policy (dry-run)</span>
              <span className="text-gray-400">→</span>
            </a>
            <a
              href="/api/monitoring/errors"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span>🔍 Error events API</span>
              <span className="text-gray-400">→</span>
            </a>
            <a
              href="/api/audit-log"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span>📝 Audit log API</span>
              <span className="text-gray-400">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
