/**
 * LLM Factory — crea client LLM con fallback automatico Gemini → Claude.
 *
 * Strategia:
 * 1. Prova Gemini (createGeminiClient) — provider primario
 * 2. Se Gemini è unavailable (rate limit, 503, overloaded), switcha a Claude Haiku
 * 3. Fallback Claude richiede ANTHROPIC_API_KEY nell'env (opt-in)
 *
 * Il wrapping è a livello di singola chiamata .complete() — ogni richiesta può
 * fare fallback indipendentemente, non tutta la sessione.
 *
 * Nessuna dipendenza da @anthropic-ai/sdk — usa fetch diretto per non aggiungere
 * una dipendenza obbligatoria.
 */

import { createGeminiClient } from './gemini'
import type { LlmClient } from './orchestrator/agentExecution'

// Pattern di errore che indicano che il provider è temporaneamente unavailable
const FALLBACK_ERROR_PATTERNS = [
  'rate limit',
  'quota exceeded',
  'service unavailable',
  'overloaded',
  '429',
  '503',
  'too many requests',
  'resource has been exhausted',
]

function isRetryableOnFallback(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return FALLBACK_ERROR_PATTERNS.some((p) => msg.includes(p))
}

function createClaudeHaikuFallback(): LlmClient | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  return {
    async complete(args) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2048,
          system: args.system,
          messages: [{ role: 'user', content: args.user }],
        }),
      })

      if (!response.ok) {
        throw new Error(`Claude fallback API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>
      }
      const text = data.content.find((c) => c.type === 'text')?.text ?? ''
      return { text }
    },
  }
}

/**
 * Crea un LlmClient con fallback automatico Gemini → Claude Haiku.
 *
 * Se ANTHROPIC_API_KEY non è configurata, si comporta identicamente a
 * `createGeminiClient()` — zero breaking changes.
 */
export function createLlmWithFallback(): LlmClient {
  const primary = createGeminiClient()
  const fallback = createClaudeHaikuFallback()

  if (!fallback) return primary

  return {
    async complete(args) {
      try {
        return await primary.complete(args)
      } catch (error) {
        if (isRetryableOnFallback(error)) {
          console.warn(
            '[llmFactory] Gemini unavailable, falling back to Claude Haiku:',
            error instanceof Error ? error.message : String(error),
          )
          return await fallback.complete(args)
        }
        throw error
      }
    },
  }
}
