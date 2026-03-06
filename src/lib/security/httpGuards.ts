const WINDOW_MS_DEFAULT = 60_000

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

function cleanupRateLimitStore(now: number): void {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

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
  cleanupRateLimitStore(now)

  const existing = rateLimitStore.get(options.key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    rateLimitStore.set(options.key, { count: 1, resetAt })
    return { ok: true, remaining: Math.max(0, options.max - 1), resetAt }
  }

  if (existing.count >= options.max) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return { ok: false, retryAfterSec, resetAt: existing.resetAt }
  }

  existing.count += 1
  return {
    ok: true,
    remaining: Math.max(0, options.max - existing.count),
    resetAt: existing.resetAt,
  }
}

export function resetRateLimitStoreForTests(): void {
  rateLimitStore.clear()
}
