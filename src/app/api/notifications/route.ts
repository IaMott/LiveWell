import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth'

/**
 * GET /api/notifications
 * Returns the 20 most recent notifications for the authenticated user.
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
    })

    const unreadCount = notifications.filter((n) => !n.read).length

    return NextResponse.json({ notifications, unreadCount })
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

/**
 * PATCH /api/notifications
 * Body: { ids?: string[] } — mark notifications as read.
 * If ids is omitted, marks ALL notifications as read.
 */
export async function PATCH(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let ids: string[] | undefined
  try {
    const body = (await request.json()) as { ids?: string[] }
    ids = Array.isArray(body.ids) ? body.ids : undefined
  } catch {
    // no body — mark all
  }

  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
