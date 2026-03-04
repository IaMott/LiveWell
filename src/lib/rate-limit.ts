import { NextResponse } from 'next/server'

/**
 * In-memory sliding-window rate limiter.
 * Works within a single process (Node.js / Vercel warm lambda).
 * For distributed environments, replace with Upstash Redis or Vercel Firewall.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()

/** Lazy cleanup: remove expired entries at most once per minute */
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

/** Extract client IP from request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || '127.0.0.1'
}

/**
 * Check rate limit for a given identifier.
 * @param identifier - Unique key (e.g. "chat:userId" or "register:ip")
 * @param max - Max requests allowed in window
 * @param windowMs - Window duration in milliseconds (default 60s)
 */
export function rateLimit(
  identifier: string,
  { max, windowMs = 60_000 }: { max: number; windowMs?: number },
): { success: boolean; remaining: number; resetAt: number } {
  cleanup()
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: max - 1, resetAt: now + windowMs }
  }

  if (entry.count >= max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

/** Standard 429 response with Retry-After header */
export function rateLimitResponse(resetAt: number): NextResponse {
  return NextResponse.json(
    { error: 'Troppe richieste. Riprova tra poco.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    },
  )
}
