/**
 * LLM-based data extraction — LiveWell
 *
 * Uses a lightweight Gemini Flash call to extract ALL structured data
 * from any Italian user message, replacing fragile regex patterns.
 *
 * Runs IN PARALLEL with the main orchestration pipeline (~1s vs 3-8s)
 * so it adds ZERO latency to the user experience.
 *
 * Falls back gracefully to [] on any error (timeout, parse, API).
 */

import type { LlmClient } from './agentExecution'
import type { Domain, ToolCall } from '../types'

const EXTRACTION_SYSTEM_PROMPT = `Sei un estrattore di dati strutturati da messaggi in italiano.
Analizza il messaggio dell'utente ed estrai TUTTI i dati che l'utente sta comunicando su di sé.

Restituisci un array JSON di oggetti. Ogni oggetto ha:
- domain: "health" | "nutrition" | "training" | "mindfulness" | "personal" | "general"
- key: una delle chiavi elencate sotto
- value: il valore estratto (numero, stringa, o booleano)
- unit: unità di misura opzionale

Chiavi valide per domain:
- personal: weight, height, age, gender, name, birthDate, smokingStatus
- health: blood_pressure, symptoms, diagnosis, medications, complaint, restingHr
- nutrition: allergy, goal, meal_pattern, food_triggers, metabolic_condition, dietType, intolerances
- training: training_frequency_per_week, fitness_level, sport, injury, goal
- mindfulness: stress_level, sleep_hours, sleep_quality, complaint, distress_intensity
- general: goal, declared_goal

Regole fondamentali:
- Estrai SOLO fatti che l'utente dichiara su di sé, MAI domande
- Negazioni sono dati: "nessuna allergia" → {domain:"nutrition", key:"allergy", value:"nessuna"}
- Genere: "maschio"/"uomo"/"M" → value:"male"; "femmina"/"donna"/"F" → value:"female"
- Età: se l'utente dice "34 anni" → {domain:"personal", key:"age", value:34, unit:"years"}
- Peso: numeri con kg/chili → {domain:"personal", key:"weight", value:N, unit:"kg"}
- Altezza: numeri con cm → {domain:"personal", key:"height", value:N, unit:"cm"}
- Sport/attività: "vado in palestra", "faccio pesi", "nuoto" → {domain:"training", key:"sport", value:"..."}
- Frequenza: "3 volte a settimana" → {domain:"training", key:"training_frequency_per_week", value:3, unit:"sessions/week"}
- Obiettivi: "dimagrire", "perdere peso" → {domain:"general", key:"goal", value:"dimagrire"}
- Allergie: "allergico alle muffe" → {domain:"nutrition", key:"allergy", value:"muffe"}
- Trigger: "alcolici mi fanno male" → {domain:"nutrition", key:"food_triggers", value:"alcolici"}
- Se non trovi dati da estrarre, restituisci []
- Rispondi SOLO con l'array JSON, niente altro testo`

const EXTRACTION_TIMEOUT_MS = 5_000

type ExtractedItem = {
  domain: string
  key: string
  value: unknown
  unit?: string
}

const VALID_DOMAINS = new Set([
  'health',
  'nutrition',
  'training',
  'mindfulness',
  'personal',
  'general',
  'career',
  'financial',
])

const VALID_KEYS = new Set([
  'weight',
  'height',
  'age',
  'gender',
  'name',
  'birthDate',
  'smokingStatus',
  'blood_pressure',
  'symptoms',
  'diagnosis',
  'medications',
  'complaint',
  'restingHr',
  'allergy',
  'goal',
  'declared_goal',
  'meal_pattern',
  'food_triggers',
  'metabolic_condition',
  'dietType',
  'intolerances',
  'training_frequency_per_week',
  'fitness_level',
  'sport',
  'injury',
  'stress_level',
  'sleep_hours',
  'sleep_quality',
  'distress_intensity',
])

function validateAndConvert(items: unknown): ToolCall[] {
  if (!Array.isArray(items)) return []

  const now = new Date().toISOString()
  const calls: ToolCall[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const { domain, key, value, unit } = item as ExtractedItem

    // Validate domain and key
    if (typeof domain !== 'string' || !VALID_DOMAINS.has(domain)) continue
    if (typeof key !== 'string' || !VALID_KEYS.has(key)) continue
    if (value === undefined || value === null || value === '') continue

    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain,
        key,
        value,
        ...(unit && typeof unit === 'string' ? { unit } : {}),
        recordedAt: now,
      },
    })
  }

  return calls
}

function parseJsonArray(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {
    // Try to extract JSON array from markdown code blocks or surrounding text
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        return []
      }
    }
    return []
  }
}

/**
 * Extract structured user attributes from a message using LLM.
 *
 * Designed to run IN PARALLEL with the main orchestration pipeline.
 * Returns [] on any error (timeout, parse failure, API error).
 */
export async function llmExtractAttributes(
  llm: LlmClient,
  message: string,
  _domainHint: Domain,
): Promise<ToolCall[]> {
  // Skip very short messages (unlikely to contain structured data)
  if (message.trim().length < 3) return []

  // Skip tool directives
  if (message.startsWith('/tool ')) return []

  try {
    const result = await Promise.race([
      llm.complete({
        system: EXTRACTION_SYSTEM_PROMPT,
        user: message,
        format: 'json',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM extraction timeout')), EXTRACTION_TIMEOUT_MS),
      ),
    ])

    const parsed = parseJsonArray(result.text)
    return validateAndConvert(parsed)
  } catch {
    // Graceful degradation — regex fallback will still run
    return []
  }
}
