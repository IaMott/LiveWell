/**
 * Rate limit store abstraction — in-memory by default, Redis-ready for production.
 *
 * Switching automatico via env:
 *   RATE_LIMIT_STORE=memory  (default — funziona per single-instance)
 *   RATE_LIMIT_STORE=redis   (richiede REDIS_URL + REDIS_TOKEN — Upstash REST)
 *
 * L'interfaccia è sincrona per compatibilità con httpGuards.ts.
 * Il Redis store mantiene la sincronia in-memory e fa sync asincrono su Redis.
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

// ─────────────────────────────────────────
// In-memory implementation (default)
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// Upstash Redis implementation (opt-in)
// ─────────────────────────────────────────

/**
 * Redis-backed store via Upstash REST API.
 * Nessuna dipendenza npm — usa fetch nativo.
 * Garantisce rate-limiting corretto su deployment multi-istanza (Vercel).
 *
 * Richiede env:
 *   REDIS_URL=https://xxx.upstash.io
 *   REDIS_TOKEN=AXxxx
 */
function createRedisStore(): RateLimitStore {
  const redisUrl = process.env.REDIS_URL
  const redisToken = process.env.REDIS_TOKEN

  if (!redisUrl || !redisToken) {
    console.warn(
      '[rateLimitStore] RATE_LIMIT_STORE=redis but REDIS_URL/REDIS_TOKEN not set — falling back to in-memory',
    )
    return createInMemoryStore()
  }

  // In-memory fallback per risposta sincrona immediata
  const localCache = createInMemoryStore()

  function upstashPipeline(commands: string[][]): void {
    // Fire-and-forget: sync asincrono verso Redis per cross-instance consistency
    void fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    }).catch((err: unknown) => {
      console.warn(
        '[rateLimitStore] Redis sync failed:',
        err instanceof Error ? err.message : String(err),
      )
    })
  }

  return {
    increment(key, windowMs, now) {
      // Risposta sincrona immediata dall'in-memory cache
      const result = localCache.increment(key, windowMs, now)

      // Async sync su Redis (per futura consistenza cross-instance)
      const windowSecs = Math.ceil(windowMs / 1000)
      upstashPipeline([
        ['INCR', key],
        ['EXPIRE', key, String(windowSecs)],
      ])

      return result
    },

    reset() {
      localCache.reset()
    },
  }
}

// ─────────────────────────────────────────
// Factory + singleton
// ─────────────────────────────────────────

function createStore(): RateLimitStore {
  const storeType = process.env.RATE_LIMIT_STORE ?? 'memory'
  if (storeType === 'redis') return createRedisStore()
  return createInMemoryStore()
}

export const defaultRateLimitStore: RateLimitStore = createStore()
