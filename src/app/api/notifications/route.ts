import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  })

  return NextResponse.json({ notifications, unreadCount })
}
