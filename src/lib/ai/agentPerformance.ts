/**
 * Agent Performance Tracking
 *
 * Traccia confidence, latenza e selezione degli agenti per analisi della
 * qualità nel tempo. Permette di identificare agenti che performano peggio
 * e migliorare il routing e la selezione.
 *
 * Fire-and-forget: non blocca il turn principale.
 */

import type { AgentProposal } from './types'

export type AgentPerformanceEntry = {
  userId: string
  conversationId: string
  requestId: string
  agentId: string
  round: 1 | 2
  domain: string
  confidence: number
  durationMs?: number
  wasSelected: boolean
}

/**
 * Calcola un hash deterministico di una AgentProposal per deduplicazione.
 */
export function hashProposal(proposal: AgentProposal): string {
  const key = `${proposal.agentId}:${proposal.domain}:${(proposal.summary ?? '').slice(0, 100)}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

/**
 * Costruisce gli entry di performance dai round proposals.
 * Chiamato dopo l'esecuzione dei round, prima del commit su DB.
 */
export function buildPerformanceEntries(params: {
  userId: string
  conversationId: string
  requestId: string
  round1Proposals: AgentProposal[]
  round2Proposals: AgentProposal[]
  selectedAgentIds: string[]
}): AgentPerformanceEntry[] {
  const { userId, conversationId, requestId, round1Proposals, round2Proposals, selectedAgentIds } =
    params
  const selectedSet = new Set(selectedAgentIds)
  const entries: AgentPerformanceEntry[] = []

  for (const p of round1Proposals) {
    entries.push({
      userId,
      conversationId,
      requestId,
      agentId: p.agentId,
      round: 1,
      domain: p.domain,
      confidence: p.confidence ?? 0,
      wasSelected: selectedSet.has(p.agentId),
    })
  }

  for (const p of round2Proposals) {
    entries.push({
      userId,
      conversationId,
      requestId,
      agentId: p.agentId,
      round: 2,
      domain: p.domain,
      confidence: p.confidence ?? 0,
      wasSelected: selectedSet.has(p.agentId),
    })
  }

  return entries
}

/**
 * Persiste i log di performance su DB in modo fire-and-forget.
 * Non lancia eccezioni — failure silenziosa per non impattare il turn principale.
 */
export async function persistPerformanceLogs(entries: AgentPerformanceEntry[]): Promise<void> {
  if (entries.length === 0) return
  if (process.env.NODE_ENV === 'test') return

  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.agentPerformanceLog.createMany({
      data: entries.map((e) => ({
        userId: e.userId,
        conversationId: e.conversationId,
        agentId: e.agentId,
        requestId: e.requestId,
        round: e.round,
        domain: e.domain,
        confidence: e.confidence,
        proposalHash: `${e.agentId}:${e.round}:${e.conversationId}`,
        durationMs: e.durationMs,
        wasSelected: e.wasSelected,
      })),
      skipDuplicates: true,
    })
  } catch {
    // Fire-and-forget: performance logging failure must never break a user turn
  }
}
