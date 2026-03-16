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
import type { LlmClient } from './orchestrator/agentExecution'
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
    async complete(
      { format = 'json' } = {} as { system: string; user: string; format?: 'json' | 'text' },
    ) {
      if (format === 'text') {
        return { text: 'Modalità mock attiva.' }
      }
      return {
        text: JSON.stringify({
          domain: 'general',
          summary: 'Modalità mock attiva.',
          reasoning: 'Modalità mock attiva: GEMINI_API_KEY non configurata.',
          questions: [],
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
    async complete({ system, user, format = 'json', imageData }) {
      const systemInstruction = format === 'json' ? system + JSON_OUTPUT_INSTRUCTION : system

      // Build multimodal contents when images are provided
      type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

      let contents: string | Array<{ parts: GeminiPart[] }>
      if (imageData && imageData.length > 0) {
        const parts: GeminiPart[] = [{ text: user }]
        for (const img of imageData) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
        }
        contents = [{ parts }]
      } else {
        contents = user
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: format === 'json' ? 0.7 : 0.85,
          maxOutputTokens: format === 'json' ? 2048 : 8192,
        },
      })

      const raw = response.text ?? ''
      // Strip markdown code fences if the model wraps JSON in ```json ... ```
      const text = raw
        .trim()
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '')
      return { text }
    },
  }
}
