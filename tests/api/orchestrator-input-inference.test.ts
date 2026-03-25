import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ageFromIsoDate,
  inferAttributeToolCallsFromMessage,
  isAgeQuestion,
  parseDobFromNaturalMessage,
  readPersonalSnapshot,
} from '@/lib/ai/orchestrator/inputInference'
import type { ActiveSpecialist, ContextPack } from '@/lib/ai/types'

const contextPack: ContextPack = {
  user: {
    id: 'u1',
    role: 'USER',
    profile: {},
  },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

describe('orchestrator input inference helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses birth date from numeric and textual natural language formats', () => {
    expect(parseDobFromNaturalMessage('sono nato il 26/06/1991')).toBe('1991-06-26')
    expect(parseDobFromNaturalMessage('sono nata il 26 giugno 1991')).toBe('1991-06-26')
  })

  it('detects age questions and computes age from iso date deterministically', () => {
    expect(isAgeQuestion('Quanti anni ho?')).toBe(true)
    expect(isAgeQuestion('Mi dici quanti anni ho adesso?')).toBe(true)
    expect(ageFromIsoDate('1991-06-26')).toBe(34)
  })

  it('prefers personal attributes over profile values in personal snapshot', () => {
    const withData: ContextPack = {
      ...contextPack,
      user: {
        ...contextPack.user,
        profile: {
          birthDate: '1991-06-26',
          height: 180,
          weight: 82,
        },
        attributes: {
          personal: {
            birthDate: { value: '1990-01-15', recordedAt: new Date().toISOString() },
            height: { value: 178, recordedAt: new Date().toISOString() },
          },
        },
      },
    }

    expect(readPersonalSnapshot(withData)).toEqual({
      birthDate: '1990-01-15',
      height: 178,
      weight: 82,
    })
  })

  it('infers fallback user.setAttribute tool calls from natural chat without agent tool output', () => {
    const activeSpecialist: ActiveSpecialist = {
      id: 'fisioterapista',
      displayName: 'Fisioterapista',
      domain: 'training',
      domains: ['training', 'health'],
    }

    const calls = inferAttributeToolCallsFromMessage(
      'ho 35 anni, sono nato il 26/06/1991, ho stress 8 su 10 e dormo 5 ore',
      { domainHint: 'mindfulness', activeSpecialist },
    )

    expect(calls.some((c) => JSON.stringify(c.args).includes('"key":"birthDate"'))).toBe(true)
    expect(calls.some((c) => JSON.stringify(c.args).includes('"key":"stress_level"'))).toBe(true)
    expect(calls.some((c) => JSON.stringify(c.args).includes('"key":"sleep_hours"'))).toBe(true)
    expect(calls.some((c) => JSON.stringify(c.args).includes('Data di nascita approssimata'))).toBe(
      true,
    )
  })
})
