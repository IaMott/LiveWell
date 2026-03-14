/**
 * Weighted merge utilities per il consensus engine.
 *
 * I proposal con confidence più alta hanno peso maggiore nel determinare:
 * - La risposta finale (via score aggregato)
 * - I tool call da eseguire (filtrati per soglia minima)
 * - Le raccomandazioni prioritarie
 *
 * Formula peso: w(p) = confidence^1.5  (penalizza di più la bassa confidence)
 */

import type { AgentProposal } from '../types'

const MIN_CONFIDENCE_FOR_TOOLS = 0.3
const MIN_CONFIDENCE_FOR_RECOMMENDATIONS = 0.25

/** Peso non-lineare: amplifica la differenza tra 0.9 e 0.5 */
function weight(confidence: number): number {
  return Math.pow(Math.max(0, confidence), 1.5)
}

/**
 * Ordina i proposal per peso decrescente.
 * Filtra via i proposal con confidence = 0 (timeout/fallback).
 */
export function rankByWeight(proposals: AgentProposal[]): AgentProposal[] {
  return [...proposals]
    .filter((p) => (p.confidence ?? 0) > 0)
    .sort((a, b) => weight(b.confidence ?? 0) - weight(a.confidence ?? 0))
}

/**
 * Seleziona i tool call da eseguire, filtrando per soglia di confidence minima.
 * In caso di tool call duplicati (stessa tool name + stessi args) usa quello
 * proveniente dal proposal con confidence più alta.
 */
export function mergeToolCallsWeighted(
  proposals: AgentProposal[],
): NonNullable<AgentProposal['toolCalls']> {
  const ranked = rankByWeight(proposals)
  const seen = new Set<string>()
  const result: NonNullable<AgentProposal['toolCalls']> = []

  for (const proposal of ranked) {
    if ((proposal.confidence ?? 0) < MIN_CONFIDENCE_FOR_TOOLS) continue
    for (const tc of proposal.toolCalls ?? []) {
      const dedupeKey = `${tc.name}:${JSON.stringify(tc.args)}`
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey)
        result.push(tc)
      }
    }
  }

  return result
}

/**
 * Merged recommendations: deduplicati per titolo, ordinati per peso.
 * Usa `rationale` come body (aligned with AgentProposal.recommendations type).
 */
export function mergeRecommendationsWeighted(
  proposals: AgentProposal[],
): Array<{ title: string; rationale: string; agentId: string; confidence: number }> {
  const ranked = rankByWeight(proposals)
  const seen = new Set<string>()
  const result: Array<{ title: string; rationale: string; agentId: string; confidence: number }> =
    []

  for (const proposal of ranked) {
    if ((proposal.confidence ?? 0) < MIN_CONFIDENCE_FOR_RECOMMENDATIONS) continue
    for (const rec of proposal.recommendations ?? []) {
      const key = rec.title.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        result.push({
          title: rec.title,
          rationale: rec.rationale,
          agentId: proposal.agentId,
          confidence: proposal.confidence ?? 0,
        })
      }
    }
  }

  return result
}

/**
 * Calcola un "confidence score" aggregato per il consensus.
 * Usa media pesata: sum(w_i * c_i) / sum(w_i)
 */
export function aggregateConfidence(proposals: AgentProposal[]): number {
  const active = proposals.filter((p) => (p.confidence ?? 0) > 0)
  if (active.length === 0) return 0

  const totalWeight = active.reduce((sum, p) => sum + weight(p.confidence ?? 0), 0)
  const weightedSum = active.reduce(
    (sum, p) => sum + weight(p.confidence ?? 0) * (p.confidence ?? 0),
    0,
  )
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/**
 * Rileva conflitti significativi: due proposal sullo stesso dominio
 * con confidence > 0.5 che si contraddicono (heuristic basata su summary).
 */
export function detectWeightedConflicts(proposals: AgentProposal[]): string[] {
  const conflicts: string[] = []
  const highConfidence = proposals.filter((p) => (p.confidence ?? 0) >= 0.5)

  for (let i = 0; i < highConfidence.length; i++) {
    for (let j = i + 1; j < highConfidence.length; j++) {
      const a = highConfidence[i]
      const b = highConfidence[j]
      if (!a || !b) continue
      if (a.domain !== b.domain) continue

      // Heuristic: se i summary contengono indicatori opposti
      const opposites = [
        ['aumenta', 'riduci'],
        ['sì', 'no'],
        ['consiglio', 'sconsiglio'],
        ['sicuro', 'pericoloso'],
        ['appropriato', 'inappropriato'],
      ]

      const aText = (a.summary + ' ' + (a.reasoning ?? '')).toLowerCase()
      const bText = (b.summary + ' ' + (b.reasoning ?? '')).toLowerCase()

      for (const [pos, neg] of opposites) {
        if (!pos || !neg) continue
        if (
          (aText.includes(pos) && bText.includes(neg)) ||
          (aText.includes(neg) && bText.includes(pos))
        ) {
          conflicts.push(
            `Conflitto tra ${a.agentId} (conf:${(a.confidence ?? 0).toFixed(2)}) e ${b.agentId} (conf:${(b.confidence ?? 0).toFixed(2)}) su dominio ${a.domain}`,
          )
          break
        }
      }
    }
  }

  return conflicts
}
