/**
 * GET /api/notifications/stream
 *
 * Server-Sent Events endpoint per notifiche real-time.
 * Il client si connette una volta e riceve push di nuove notifiche.
 *
 * Protocol:
 *   event: notification
 *   data: <JSON NotificationPayload>
 *
 *   event: ping (ogni 20s per keep-alive)
 *   data: {"ts": <ms>}
 *
 * Il client deve gestire la reconnection automatica (standard SSE behavior).
 * Limit: 1 connessione per utente considerata sicura (Vercel Edge streaming ok).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth'

const POLL_INTERVAL_MS = 5_000
const PING_INTERVAL_MS = 20_000
const MAX_STREAM_MS = 4 * 60 * 1000 // 4 min (Vercel timeout safety)

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let lastSeenAt = new Date()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      function send(eventName: string, data: unknown): void {
        if (closed) return
        try {
          const chunk = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(chunk))
        } catch {
          closed = true
        }
      }

      // Send initial unread count
      try {
        const unread = await prisma.notification.count({
          where: { userId, read: false },
        })
        send('init', { unreadCount: unread })
      } catch {
        // non-fatal
      }

      // Poll loop
      const pollHandle = setInterval(async () => {
        if (closed) {
          clearInterval(pollHandle)
          clearInterval(pingHandle)
          return
        }
        try {
          const newNotifs = await prisma.notification.findMany({
            where: {
              userId,
              createdAt: { gt: lastSeenAt },
            },
            orderBy: { createdAt: 'asc' },
            take: 10,
            select: {
              id: true,
              type: true,
              title: true,
              message: true,
              read: true,
              createdAt: true,
            },
          })

          if (newNotifs.length > 0) {
            lastSeenAt = newNotifs[newNotifs.length - 1].createdAt
            for (const n of newNotifs) {
              send('notification', n)
            }
          }
        } catch {
          // DB temporarily unavailable — don't crash the stream
        }
      }, POLL_INTERVAL_MS)

      // Ping loop (keep-alive)
      const pingHandle = setInterval(() => {
        send('ping', { ts: Date.now() })
      }, PING_INTERVAL_MS)

      // Auto-close after MAX_STREAM_MS (client will reconnect)
      setTimeout(() => {
        clearInterval(pollHandle)
        clearInterval(pingHandle)
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      }, MAX_STREAM_MS)

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollHandle)
        clearInterval(pingHandle)
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx: disabilita buffering
    },
  })
}
