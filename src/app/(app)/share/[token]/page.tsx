import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

type SharePayload = {
  token: string
  resourceType: string
  resourceId: string
  expiresAt: string | null
  shareUrl: string
  createdAt: string
}

function isSharePayload(v: unknown): v is SharePayload {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return typeof obj.token === 'string' && typeof obj.resourceId === 'string'
}

export default async function ShareTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Find the share token attribute for this user
  const attr = await prisma.userAttribute.findFirst({
    where: {
      userId: session.user.id,
      domain: 'general',
      key: 'share_token',
    },
    orderBy: { recordedAt: 'desc' },
    select: { value: true, recordedAt: true },
  })

  if (!attr) notFound()

  let payload: SharePayload | null = null
  try {
    const raw = typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value
    if (isSharePayload(raw) && raw.token === token) {
      payload = raw
    }
  } catch {
    notFound()
  }

  if (!payload) notFound()

  // Check expiry
  if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Link scaduto</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Questo link di condivisione è scaduto il{' '}
            {new Date(payload.expiresAt).toLocaleDateString('it-IT')}.
          </p>
          <Link
            href="/profile/overview"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Torna al profilo
          </Link>
        </div>
      </div>
    )
  }

  // Fetch the referenced artifact
  const artifact = await prisma.recommendationArtifact
    .findFirst({
      where: { id: payload.resourceId, userId: session.user.id },
      select: { type: true, title: true, contentMarkdown: true, createdAt: true },
    })
    .catch(() => null)

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/profile/overview"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Torna al profilo
          </Link>
          <span className="text-xs text-muted-foreground">
            Condiviso il {new Date(payload.createdAt).toLocaleDateString('it-IT')}
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {payload.resourceType.replace(/_/g, ' ')}
            </span>
          </div>

          {artifact ? (
            <>
              <h1 className="text-2xl font-bold mb-4">{artifact.title}</h1>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {artifact.contentMarkdown}
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Generato il {new Date(artifact.createdAt).toLocaleDateString('it-IT')} da LiveWell
              </p>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Contenuto non trovato o non più disponibile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
