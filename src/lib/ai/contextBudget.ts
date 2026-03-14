/**
 * Token budget management per agenti.
 *
 * Problema: il ContextPack viene passato intero a ogni agente → spreco di token.
 * Soluzione: filtrare/troncare il ContextPack per rilevanza rispetto al dominio
 * dell'agente, riducendo il token footprint per chiamata LLM.
 *
 * Stima token: ~4 char/token (approssimazione senza tiktoken dependency).
 * Budget default: 2000 token per history/trackers per agente.
 */

import type { ContextPack, Domain } from './types'

const CHARS_PER_TOKEN = 4
const DEFAULT_HISTORY_BUDGET_TOKENS = 2_000

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function truncateToTokenBudget(text: string, budgetTokens: number): string {
  const budgetChars = budgetTokens * CHARS_PER_TOKEN
  if (text.length <= budgetChars) return text
  return text.slice(0, budgetChars) + '… [troncato per budget token]'
}

/**
 * Tracker keys rilevanti per ciascun dominio.
 * Gli agenti ricevono solo i trackers del proprio dominio — gli altri vengono omessi.
 */
const DOMAIN_TRACKER_MAP: Record<Domain, Array<keyof NonNullable<ContextPack['trackers']>>> = {
  nutrition: ['nutrition'],
  health: ['health'],
  training: ['training'],
  mindfulness: ['mindfulness'],
  general: ['health', 'nutrition', 'training', 'mindfulness'],
  inspiration: ['mindfulness'],
  coordination: ['health', 'nutrition', 'training', 'mindfulness'],
}

/**
 * Filtra il ContextPack per rilevanza rispetto al dominio dell'agente:
 * - Mantiene user profile completo (piccolo)
 * - Include solo i trackers del dominio rilevante (no data leakage cross-domain)
 * - Tronca recentMessages se supera il budget token stimato
 * - Mantiene agentWorkspaces intatti (piccoli, contengono pending questions)
 */
export function budgetContextPackForAgent(
  contextPack: ContextPack,
  agentDomain: Domain,
  historyBudgetTokens: number = DEFAULT_HISTORY_BUDGET_TOKENS,
): ContextPack {
  // Filtra trackers per dominio
  const relevantKeys = DOMAIN_TRACKER_MAP[agentDomain] ?? []
  const filteredTrackers: ContextPack['trackers'] = {}
  for (const key of relevantKeys) {
    const tracker = contextPack.trackers?.[key]
    if (tracker !== undefined) {
      ;(filteredTrackers as Record<string, unknown>)[key] = tracker
    }
  }

  // Tronca recentMessages al budget token disponibile
  // Includi i messaggi più recenti (reverse iterate, poi riordina)
  const messages = contextPack.history.recentMessages ?? []
  let budgetRemaining = historyBudgetTokens
  const includedMessages: typeof messages = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    const msgTokens = estimateTokens(msg.content)
    if (budgetRemaining - msgTokens < 0) break
    includedMessages.unshift(msg)
    budgetRemaining -= msgTokens
  }

  return {
    ...contextPack,
    trackers: filteredTrackers,
    history: {
      ...contextPack.history,
      recentMessages: includedMessages,
    },
  }
}
