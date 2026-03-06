import { createHash, randomBytes } from 'node:crypto'
import type { ToolName } from './toolRegistry'
import { prisma } from '@/lib/prisma'

type PendingConfirmAction = {
  token: string
  userId: string
  toolName: ToolName
  payloadHash: string
  expiresAt: number
  consumedAt: number | null
}

const pendingStore = new Map<string, PendingConfirmAction>()

function isDbPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test'
}

function cleanupExpired(now: number): void {
  for (const [token, action] of pendingStore.entries()) {
    if (action.expiresAt <= now || action.consumedAt !== null) {
      pendingStore.delete(token)
    }
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function hashToolPayload(payload: unknown): string {
  const stable = stableStringify(payload)
  return createHash('sha256').update(stable).digest('hex')
}

export async function issueConfirmToken(input: {
  userId: string
  toolName: ToolName
  payload: unknown
  ttlSeconds?: number
  now?: number
}): Promise<{ confirmToken: string; expiresAt: string }> {
  const now = input.now ?? Date.now()
  cleanupExpired(now)

  const ttlMs = (input.ttlSeconds ?? 300) * 1000
  const token = randomBytes(24).toString('hex')
  const expiresAt = now + ttlMs

  const payloadHash = hashToolPayload(input.payload)

  pendingStore.set(token, {
    token,
    userId: input.userId,
    toolName: input.toolName,
    payloadHash,
    expiresAt,
    consumedAt: null,
  })

  if (!isDbPersistenceEnabled()) {
    return {
      confirmToken: token,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  try {
    await prisma.confirmAction.create({
      data: {
        id: token,
        userId: input.userId,
        toolName: input.toolName,
        payload: input.payload as object,
        payloadHash,
        expiresAt: new Date(expiresAt),
      },
    })
  } catch {
    // Fallback in-memory remains active when DB is unavailable (tests/local env without DB)
  }

  return {
    confirmToken: token,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export async function consumeConfirmToken(input: {
  confirmToken: string
  userId: string
  toolName: ToolName
  payload: unknown
  now?: number
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = input.now ?? Date.now()
  cleanupExpired(now)

  const incomingHash = hashToolPayload(input.payload)

  if (isDbPersistenceEnabled()) {
    try {
      const dbAction = await prisma.confirmAction.findUnique({
        where: { id: input.confirmToken },
      })

      if (dbAction) {
        if (dbAction.consumedAt !== null) {
          return { ok: false, reason: 'Confirm token already consumed' }
        }
        if (dbAction.expiresAt.getTime() <= now) {
          await prisma.confirmAction
            .delete({ where: { id: input.confirmToken } })
            .catch(() => undefined)
          return { ok: false, reason: 'Confirm token expired' }
        }
        if (dbAction.userId !== input.userId || dbAction.toolName !== input.toolName) {
          return { ok: false, reason: 'Confirm token does not match actor/tool' }
        }
        if (dbAction.payloadHash !== incomingHash) {
          return { ok: false, reason: 'Confirm token payload mismatch' }
        }

        await prisma.confirmAction.update({
          where: { id: input.confirmToken },
          data: { consumedAt: new Date(now) },
        })
        pendingStore.delete(input.confirmToken)
        return { ok: true }
      }
    } catch {
      // Fallback below handles environments with no DB access.
    }
  }

  const pending = pendingStore.get(input.confirmToken)
  if (!pending) {
    return { ok: false, reason: 'Confirm token not found or expired' }
  }
  if (pending.consumedAt !== null) {
    return { ok: false, reason: 'Confirm token already consumed' }
  }
  if (pending.expiresAt <= now) {
    pendingStore.delete(input.confirmToken)
    return { ok: false, reason: 'Confirm token expired' }
  }
  if (pending.userId !== input.userId || pending.toolName !== input.toolName) {
    return { ok: false, reason: 'Confirm token does not match actor/tool' }
  }

  if (incomingHash !== pending.payloadHash) {
    return { ok: false, reason: 'Confirm token payload mismatch' }
  }

  pending.consumedAt = now
  pendingStore.delete(input.confirmToken)
  return { ok: true }
}

export function resetConfirmTokenStoreForTests(): void {
  pendingStore.clear()
}
