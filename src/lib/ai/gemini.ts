/**
 * Gemini LLM client — LiveWell AI layer
 *
 * Implements LlmClient interface for the orchestrator.
 * - Uses @google/genai SDK (v1.43+)
 * - Instructs the model to output AgentProposal-compatible JSON
 * - Graceful mock fallback when GEMINI_API_KEY is not set (dev/test)
 * - Never exposes the API key to client bundles (server-only module)
 */

import { GoogleGenAI } from '@google/genai'
import type { LlmClient } from './orchestrator/orchestrator'
import { getServerEnv } from '../validators/env'

// Appended to each agent's system prompt to enforce structured JSON output.
const JSON_OUTPUT_INSTRUCTION = `

---
OUTPUT CONTRACT (mandatory):
Respond ONLY with a single valid JSON object. No markdown, no code fences, no text outside the JSON.

Required fields:
  "domain": one of "general" | "nutrition" | "health" | "training" | "mindfulness" | "inspiration"
  "summary": string (≤ 600 chars, user-visible)
  "reasoning": string (≤ 4000 chars, internal rationale)

Optional fields:
  "questions": string[]          — gating questions if data is missing
  "recommendations": Array<{title, steps, rationale, safetyNotes?}>
  "toolCalls": Array<{id, name, args}>   — proposed only; orchestrator executes
  "confidence": number 0..1
  "flags": { needsMoreInfo?, potentialRisk?, urgentEscalation? }
`

function buildMockClient(): LlmClient {
  return {
    async complete() {
      return {
        text: JSON.stringify({
          domain: 'general',
          summary:
            'Sono qui per aiutarti. Dimmi pure come posso supportarti oggi.',
          reasoning: 'Modalità mock attiva: GEMINI_API_KEY non configurata.',
          questions: ['Qual è il tuo obiettivo principale in questo momento?'],
          recommendations: [],
          toolCalls: [],
          confidence: 0.5,
        }),
      }
    },
  }
}

/**
 * Returns a real Gemini LlmClient, or a mock if GEMINI_API_KEY is absent.
 * Call once per request (cheap: no persistent connection needed).
 */
export function createGeminiClient(): LlmClient {
  const env = getServerEnv()
  const apiKey = env.GEMINI_API_KEY

  if (!apiKey) {
    return buildMockClient()
  }

  const model = env.AI_MODEL
  const ai = new GoogleGenAI({ apiKey })

  return {
    async complete({ system, user }) {
      const systemInstruction = system + JSON_OUTPUT_INSTRUCTION

      const response = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      })

      const raw = response.text ?? ''
      // Strip markdown code fences if the model wraps JSON in ```json ... ```
      const text = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      return { text }
    },
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Compatibility shims for legacy src/lib/ai/orchestrator.ts (Step 8 era).
// The new orchestrator uses createGeminiClient(). These shims let both coexist.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if GEMINI_API_KEY is configured.
 * Used by legacy orchestrator and transcribe route.
 */
export function isGeminiConfigured(): boolean {
  try {
    const env = getServerEnv()
    return Boolean(env.GEMINI_API_KEY)
  } catch {
    return false
  }
}

type LegacyAIMessage = { role: 'user' | 'assistant' | 'system'; content: string }

/**
 * Legacy response generator: wraps createGeminiClient for old orchestrator API.
 */
export async function generateResponse(
  systemPrompt: string,
  messages: LegacyAIMessage[],
): Promise<string> {
  const client = createGeminiClient()
  const userText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n\n')
  const result = await client.complete({ system: systemPrompt, user: userText })
  return result.text
}

/**
 * Legacy streaming generator: yields tokens word-by-word.
 */
export async function* generateStream(
  systemPrompt: string,
  messages: LegacyAIMessage[],
): AsyncGenerator<string> {
  const text = await generateResponse(systemPrompt, messages)
  for (const word of text.split(' ')) {
    yield word + ' '
  }
}
