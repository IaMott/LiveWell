import { describe, expect, it } from 'vitest'
import {
  budgetContextPackForAgent,
  estimateTokens,
  truncateToTokenBudget,
} from '@/lib/ai/contextBudget'
import type { ContextPack } from '@/lib/ai/types'

const makeContextPack = (overrides?: Partial<ContextPack>): ContextPack => ({
  user: { id: 'user-1', role: 'USER', profile: {}, attributes: {} },
  history: {
    recentMessages: [
      { role: 'user', content: 'Hello', createdAt: '2025-01-01T00:00:00.000Z' },
      { role: 'assistant', content: 'Hi there', createdAt: '2025-01-01T00:01:00.000Z' },
    ],
    recentArtifacts: [],
  },
  trackers: {
    nutrition: { calories: 2000 },
    health: { weight: 75 },
    training: { sessions: 3 },
    mindfulness: { mood: 7 },
  },
  notifications: { unreadCount: 0 },
  ui: { moodScore: 70 },
  ...overrides,
})

describe('estimateTokens', () => {
  it('returns positive number for non-empty string', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0)
  })

  it('returns 0 or more for empty string', () => {
    expect(estimateTokens('')).toBeGreaterThanOrEqual(0)
  })

  it('longer text = more tokens', () => {
    expect(estimateTokens('a'.repeat(100))).toBeGreaterThan(estimateTokens('a'.repeat(10)))
  })
})

describe('truncateToTokenBudget', () => {
  it('does not truncate if within budget', () => {
    const text = 'short text'
    expect(truncateToTokenBudget(text, 1000)).toBe(text)
  })

  it('truncates and appends marker if over budget', () => {
    const longText = 'a'.repeat(1000)
    const result = truncateToTokenBudget(longText, 10) // 10 tokens = 40 chars
    expect(result.length).toBeLessThan(longText.length)
    expect(result).toContain('[troncato')
  })
})

describe('budgetContextPackForAgent', () => {
  it('includes only relevant trackers for nutrition agent', () => {
    const pack = makeContextPack()
    const result = budgetContextPackForAgent(pack, 'nutrition')
    expect(result.trackers.nutrition).toBeDefined()
    expect(result.trackers.health).toBeUndefined()
    expect(result.trackers.training).toBeUndefined()
    expect(result.trackers.mindfulness).toBeUndefined()
  })

  it('includes only relevant trackers for health agent', () => {
    const pack = makeContextPack()
    const result = budgetContextPackForAgent(pack, 'health')
    expect(result.trackers.health).toBeDefined()
    expect(result.trackers.nutrition).toBeUndefined()
  })

  it('includes all trackers for general agent', () => {
    const pack = makeContextPack()
    const result = budgetContextPackForAgent(pack, 'general')
    expect(result.trackers.nutrition).toBeDefined()
    expect(result.trackers.health).toBeDefined()
    expect(result.trackers.training).toBeDefined()
    expect(result.trackers.mindfulness).toBeDefined()
  })

  it('preserves user profile intact', () => {
    const pack = makeContextPack()
    const result = budgetContextPackForAgent(pack, 'nutrition')
    expect(result.user.id).toBe('user-1')
    expect(result.user.role).toBe('USER')
  })

  it('truncates messages to fit token budget', () => {
    const manyMessages = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: 'a'.repeat(200),
      createdAt: new Date().toISOString(),
    }))
    const pack = makeContextPack({
      history: { recentMessages: manyMessages, recentArtifacts: [] },
    })

    // Very small budget: 100 tokens = 400 chars → only few messages fit
    const result = budgetContextPackForAgent(pack, 'nutrition', 100)
    expect(result.history.recentMessages.length).toBeLessThan(manyMessages.length)
  })

  it('includes most recent messages when truncating', () => {
    const messages = [
      { role: 'user' as const, content: 'old message 1', createdAt: '2025-01-01T00:00:00.000Z' },
      { role: 'user' as const, content: 'old message 2', createdAt: '2025-01-01T00:01:00.000Z' },
      { role: 'user' as const, content: 'recent message', createdAt: '2025-01-01T00:02:00.000Z' },
    ]
    const pack = makeContextPack({
      history: { recentMessages: messages, recentArtifacts: [] },
    })

    // Budget for 1-2 messages only
    const result = budgetContextPackForAgent(pack, 'nutrition', 15) // ~60 chars
    const contents = result.history.recentMessages.map((m) => m.content)
    expect(contents).toContain('recent message')
  })
})
