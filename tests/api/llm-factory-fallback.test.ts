/**
 * Tests for LLM factory fallback logic.
 * Uses module mocking to simulate Gemini errors without real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Gemini client ──────────────────────────────────────────────────────

const mockGeminiComplete = vi.fn()
vi.mock('@/lib/ai/gemini', () => ({
  createGeminiClient: () => ({
    complete: mockGeminiComplete,
  }),
}))

// ── Mock fetch for Anthropic fallback ────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Import after mocks ────────────────────────────────────────────────────────

import { createLlmWithFallback } from '@/lib/ai/llmFactory'

const ARGS = { system: 'You are a helpful agent.', user: 'Ciao, come stai?' }

describe('createLlmWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ANTHROPIC_API_KEY
  })

  describe('without ANTHROPIC_API_KEY', () => {
    it('returns Gemini result directly', async () => {
      mockGeminiComplete.mockResolvedValueOnce({ text: 'Risposta Gemini' })
      const llm = createLlmWithFallback()
      const result = await llm.complete(ARGS)
      expect(result.text).toBe('Risposta Gemini')
    })

    it('propagates Gemini error (no fallback configured)', async () => {
      mockGeminiComplete.mockRejectedValueOnce(new Error('Some Gemini error'))
      const llm = createLlmWithFallback()
      await expect(llm.complete(ARGS)).rejects.toThrow('Some Gemini error')
    })
  })

  describe('with ANTHROPIC_API_KEY', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key-123'
    })

    it('uses Gemini when it succeeds', async () => {
      mockGeminiComplete.mockResolvedValueOnce({ text: 'Gemini ok' })
      const llm = createLlmWithFallback()
      const result = await llm.complete(ARGS)
      expect(result.text).toBe('Gemini ok')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('falls back to Claude on rate limit error', async () => {
      mockGeminiComplete.mockRejectedValueOnce(new Error('429 rate limit exceeded'))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude risposta fallback' }],
        }),
      })

      const llm = createLlmWithFallback()
      const result = await llm.complete(ARGS)
      expect(result.text).toBe('Claude risposta fallback')
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('falls back to Claude on 503 service unavailable', async () => {
      mockGeminiComplete.mockRejectedValueOnce(new Error('503 service unavailable'))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude fallback 503' }],
        }),
      })

      const llm = createLlmWithFallback()
      const result = await llm.complete(ARGS)
      expect(result.text).toBe('Claude fallback 503')
    })

    it('falls back on "quota exceeded"', async () => {
      mockGeminiComplete.mockRejectedValueOnce(
        new Error('resource has been exhausted (quota exceeded)'),
      )
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'quota fallback' }],
        }),
      })

      const llm = createLlmWithFallback()
      const result = await llm.complete(ARGS)
      expect(result.text).toBe('quota fallback')
    })

    it('does NOT fall back on non-retryable errors (e.g. auth)', async () => {
      mockGeminiComplete.mockRejectedValueOnce(new Error('API key invalid'))
      const llm = createLlmWithFallback()
      await expect(llm.complete(ARGS)).rejects.toThrow('API key invalid')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('throws if Claude fallback also fails', async () => {
      mockGeminiComplete.mockRejectedValueOnce(new Error('rate limit'))
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 529,
        statusText: 'Overloaded',
      })

      const llm = createLlmWithFallback()
      await expect(llm.complete(ARGS)).rejects.toThrow('Claude fallback API error: 529')
    })

    it('calls Anthropic API with correct model and headers', async () => {
      mockGeminiComplete.mockRejectedValueOnce(new Error('overloaded'))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      })

      const llm = createLlmWithFallback()
      await llm.complete(ARGS)

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.anthropic.com/v1/messages')
      expect((opts.headers as Record<string, string>)['x-api-key']).toBe('test-key-123')
      const body = JSON.parse(opts.body as string) as { model: string }
      expect(body.model).toBe('claude-haiku-4-5')
    })
  })
})
