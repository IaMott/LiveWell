import { GoogleGenAI, type Content } from '@google/genai'
import type { AIMessage } from './types'

const MODEL = process.env.AI_MODEL || 'gemini-2.5-flash'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY non configurata')
    }
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

/** Convert our AIMessage[] to Gemini Content[] format */
function toGeminiContents(messages: AIMessage[]): Content[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
}

/** Generate a complete (non-streaming) response from Gemini */
export async function generateResponse(
  systemPrompt: string,
  messages: AIMessage[],
): Promise<string> {
  const ai = getClient()
  const contents = toGeminiContents(messages)

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  })

  return response.text ?? ''
}

/** Generate a streaming response from Gemini, yielding text chunks */
export async function* generateStream(
  systemPrompt: string,
  messages: AIMessage[],
): AsyncGenerator<string> {
  const ai = getClient()
  const contents = toGeminiContents(messages)

  const response = await ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  })

  for await (const chunk of response) {
    const text = chunk.text
    if (text) {
      yield text
    }
  }
}

/** Check if Gemini is configured and available */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}
