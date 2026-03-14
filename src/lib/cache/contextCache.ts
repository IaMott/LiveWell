/**
 * LRU Cache per ContextPack — Redis-ready.
 *
 * Riduce le query DB ridondanti quando la stessa conversazione ha più agenti
 * che costruiscono il ContextPack nello stesso turn.
 *
 * Specifiche:
 * - TTL: 30 secondi (durata max di un turn con più agenti in parallelo)
 * - Max entries: 100 (bound sulla memoria)
 * - Eviction: LRU (oldest entry rimossa quando si supera maxSize)
 *
 * Redis upgrade path: sostituire `createInMemoryLru()` con un client Redis
 * (es. Upstash) senza modificare i call sites.
 */

import type { ContextPack } from '@/lib/ai/types'

const CONTEXT_CACHE_TTL_MS = 30_000 // 30 secondi
const CONTEXT_CACHE_MAX_SIZE = 100

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

function createInMemoryLru<T>(maxSize: number) {
  // Map mantiene l'ordine di inserimento → entries più vecchie sono all'inizio
  const store = new Map<string, CacheEntry<T>>()

  function evictExpired(now: number): void {
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) store.delete(key)
    }
  }

  function evictOldest(count: number): void {
    let evicted = 0
    for (const key of store.keys()) {
      if (evicted >= count) break
      store.delete(key)
      evicted++
    }
  }

  return {
    get(key: string): T | null {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expiresAt <= Date.now()) {
        store.delete(key)
        return null
      }
      // Refresh LRU position: delete + re-insert
      store.delete(key)
      store.set(key, entry)
      return entry.value
    },

    set(key: string, value: T, ttlMs: number): void {
      evictExpired(Date.now())
      if (store.size >= maxSize) {
        evictOldest(store.size - maxSize + 1)
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    },

    delete(key: string): void {
      store.delete(key)
    },

    clear(): void {
      store.clear()
    },

    get size(): number {
      return store.size
    },
  }
}

const contextPackCache = createInMemoryLru<ContextPack>(CONTEXT_CACHE_MAX_SIZE)

export function buildContextCacheKey(userId: string, conversationId: string): string {
  return `ctx:${userId}:${conversationId}`
}

export function getCachedContextPack(userId: string, conversationId: string): ContextPack | null {
  return contextPackCache.get(buildContextCacheKey(userId, conversationId))
}

export function setCachedContextPack(
  userId: string,
  conversationId: string,
  pack: ContextPack,
): void {
  contextPackCache.set(buildContextCacheKey(userId, conversationId), pack, CONTEXT_CACHE_TTL_MS)
}

export function invalidateContextPack(userId: string, conversationId: string): void {
  contextPackCache.delete(buildContextCacheKey(userId, conversationId))
}

export function clearContextCache(): void {
  contextPackCache.clear()
}

/** Exposed for tests only */
export function getContextCacheSize(): number {
  return contextPackCache.size
}
