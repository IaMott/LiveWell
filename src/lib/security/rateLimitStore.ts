/**
 * Rate limit store abstraction — in-memory by default, Redis-ready for production.
 *
 * Current implementation: fast in-memory Map with cleanup.
 * Future upgrade: swap `createInMemoryStore()` with a Redis-backed implementation
 * (e.g. Upstash Redis) without changing any call sites.
 *
 * The store is synchronous (no async) to keep backward compatibility with
 * existing callers in httpGuards.ts.
 */

type RateLimitEntry = {
  count: number
  resetAt: number
}

export type RateLimitStore = {
  /** Increment counter for key within windowMs. Returns updated count and resetAt. */
  increment(key: string, windowMs: number, now: number): { count: number; resetAt: number }
  /** Reset the entire store — for tests only. */
  reset(): void
}

function createInMemoryStore(): RateLimitStore {
  const store = new Map<string, RateLimitEntry>()

  function cleanup(now: number): void {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }

  return {
    increment(key, windowMs, now) {
      cleanup(now)

      const existing = store.get(key)
      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs
        store.set(key, { count: 1, resetAt })
        return { count: 1, resetAt }
      }

      existing.count += 1
      return { count: existing.count, resetAt: existing.resetAt }
    },

    reset() {
      store.clear()
    },
  }
}

export const defaultRateLimitStore: RateLimitStore = createInMemoryStore()
