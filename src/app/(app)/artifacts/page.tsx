/**
 * /artifacts — Artifact browse page
 * Mostra tutti gli artifact (raccomandazioni, ricette, piani) salvati dall'AI.
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

const DOMAIN_LABELS: Record<string, string> = {
  nutrition: '🥗 Nutrizione',
  training: '💪 Allenamento',
  health: '🩺 Salute',
  mindfulness: '🧘 Mindfulness',
  general: '💡 Generale',
  personal: '👤 Personale',
}

const DOMAIN_COLORS: Record<string, string> = {
  nutrition: 'bg-green-100 text-green-800',
  training: 'bg-blue-100 text-blue-800',
  health: 'bg-red-100 text-red-800',
  mindfulness: 'bg-purple-100 text-purple-800',
  general: 'bg-yellow-100 text-yellow-800',
  personal: 'bg-gray-100 text-gray-800',
}

export default async function ArtifactsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { type, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const limit = 12
  const offset = (page - 1) * limit

  const where = {
    userId: session.user.id,
    ...(type ? { type } : {}),
  }

  const [artifacts, total] = await Promise.all([
    prisma.recommendationArtifact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        contentMarkdown: true,
        createdAt: true,
        relatedConversationId: true,
      },
    }),
    prisma.recommendationArtifact.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  // Distinct types for filter
  const allTypes = await prisma.recommendationArtifact.findMany({
    where: { userId: session.user.id },
    select: { type: true },
    distinct: ['type'],
  })
  const types = allTypes.map((t) => t.type)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">I tuoi Artifact</h1>
        <p className="mt-1 text-sm text-gray-500">
          Raccomandazioni, ricette e piani salvati dal tuo team di specialisti AI.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/artifacts"
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            !type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Tutti ({total})
        </Link>
        {types.map((t) => (
          <Link
            key={t}
            href={`/artifacts?type=${t}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              type === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {DOMAIN_LABELS[t] ?? t}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {artifacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">Nessun artifact ancora</p>
          <p className="text-sm text-gray-400 mt-1">
            Gli specialisti AI salveranno qui le loro raccomandazioni
          </p>
          <Link
            href="/"
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Inizia una conversazione
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => (
            <div
              key={a.id}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    DOMAIN_COLORS[a.type] ?? DOMAIN_COLORS.general
                  }`}
                >
                  {DOMAIN_LABELS[a.type] ?? a.type}
                </span>
                <time className="shrink-0 text-xs text-gray-400">
                  {new Date(a.createdAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </time>
              </div>

              <h3 className="mb-2 font-semibold text-gray-900 line-clamp-2">{a.title}</h3>

              <p className="flex-1 text-sm text-gray-500 line-clamp-3">
                {a.contentMarkdown.replace(/[#*`]/g, '').slice(0, 150)}
                {a.contentMarkdown.length > 150 ? '…' : ''}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                {a.relatedConversationId && (
                  <Link
                    href={`/?conversationId=${a.relatedConversationId}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Vedi conversazione →
                  </Link>
                )}
                <button
                  className="ml-auto rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  title="Copia contenuto"
                  onClick={undefined} // handled client-side
                >
                  Copia
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/artifacts?${type ? `type=${type}&` : ''}page=${page - 1}`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              ← Precedente
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Pagina {page} di {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/artifacts?${type ? `type=${type}&` : ''}page=${page + 1}`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Successiva →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
