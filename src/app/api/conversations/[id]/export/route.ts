import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { id } = await params

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true, createdAt: true },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  const lines: string[] = [
    'LiveWell — Conversazione',
    `Esportata il: ${new Date().toLocaleString('it-IT')}`,
    '─'.repeat(40),
    '',
  ]

  for (const m of conversation.messages) {
    const who = m.role === 'user' ? 'Tu' : 'LiveWell'
    const ts = new Date(m.createdAt).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    lines.push(`[${ts}] ${who}:`)
    lines.push(m.content)
    lines.push('')
  }

  const text = lines.join('\n')

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="livewell-${id.slice(0, 8)}.txt"`,
    },
  })
}
