import { defaultRateLimitStore } from './rateLimitStore'

const WINDOW_MS_DEFAULT = 60_000

export function getUserIdFromRequest(request: Request): string | null {
  const userId = request.headers.get('x-user-id')?.trim() ?? ''
  return userId.length > 0 ? userId : null
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}

export function checkRateLimit(options: {
  key: string
  max: number
  windowMs?: number
  now?: number
}):
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSec: number; resetAt: number } {
  const now = options.now ?? Date.now()
  const windowMs = options.windowMs ?? WINDOW_MS_DEFAULT

  const { count, resetAt } = defaultRateLimitStore.increment(options.key, windowMs, now)

  if (count > options.max) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000))
    return { ok: false, retryAfterSec, resetAt }
  }

  return { ok: true, remaining: Math.max(0, options.max - count), resetAt }
}

export function resetRateLimitStoreForTests(): void {
  defaultRateLimitStore.reset()
}
