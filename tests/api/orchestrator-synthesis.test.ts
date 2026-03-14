import { describe, expect, it, vi } from 'vitest'
import { synthesizeRawResponse } from '@/lib/ai/orchestrator/synthesis'
import type { AgentProposal, ContextPack } from '@/lib/ai/types'

const contextPack: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: {
    recentMessages: [
      { role: 'user', content: 'ciao', createdAt: '2026-03-13T10:00:00.000Z' },
      { role: 'assistant', content: 'dimmi pure', createdAt: '2026-03-13T10:00:10.000Z' },
    ],
    recentArtifacts: [],
  },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

const proposals: AgentProposal[] = [
  {
    agentId: 'dietista',
    domain: 'nutrition',
    summary: 'Prima summary',
    reasoning: 'ok',
    questions: [],
    recommendations: [
      {
        title: 'Azione 1',
        steps: ['step a', 'step b', 'step c'],
        rationale: 'ok',
      },
    ],
    toolCalls: [],
    confidence: 0.7,
  },
  {
    agentId: 'gastroenterologo',
    domain: 'health',
    summary: 'Seconda summary',
    reasoning: 'ok',
    questions: [],
    recommendations: [
      {
        title: 'Azione 2',
        steps: ['step x', 'step y'],
        rationale: 'ok',
      },
    ],
    toolCalls: [],
    confidence: 0.9,
  },
]

describe('synthesis boundary', () => {
  it('returns raw text from llm and builds expected prompt markers', async () => {
    const complete = vi.fn().mockResolvedValue({ text: 'Risposta finale.' })

    const result = await synthesizeRawResponse({
      llm: { complete },
      userMessage: 'voglio un piano alimentare',
      proposals,
      gatingQuestions: ['Hai allergie?'],
      criticalQuestions: ['Hai allergie?'],
      contextPack,
    })

    expect(result).toEqual({ rawText: 'Risposta finale.', fallbackUsed: false })
    expect(complete).toHaveBeenCalledTimes(1)
    const call = complete.mock.calls[0]?.[0]
    expect(call?.format).toBe('text')
    expect(call?.system).toContain('coordinatore del team LiveWell')
    expect(call?.user).toContain('CONVERSAZIONE RECENTE:')
    expect(call?.user).toContain('ANALISI DEL TEAM SPECIALISTICO:')
    expect(call?.user).toContain('RACCOMANDAZIONI DEL TEAM:')
    expect(call?.user).toContain('DATI MANCANTI IDENTIFICATI DAL TEAM')
    expect(call?.user).toContain('Hai allergie?')
    expect(call?.user.indexOf('Seconda summary')).toBeLessThan(call?.user.indexOf('Prima summary'))
  })

  it('falls back to the first available proposal summary when model returns json-like text', async () => {
    const result = await synthesizeRawResponse({
      llm: {
        complete: vi.fn().mockResolvedValue({ text: '{"summary":"json"}' }),
      },
      userMessage: 'voglio un piano alimentare',
      proposals,
      gatingQuestions: [],
      criticalQuestions: [],
      contextPack,
    })

    expect(result).toEqual({ rawText: 'Prima summary', fallbackUsed: true })
  })

  it('falls back to default message when llm fails and no proposal summary exists', async () => {
    const result = await synthesizeRawResponse({
      llm: {
        complete: vi.fn().mockRejectedValue(new Error('boom')),
      },
      userMessage: 'ciao',
      proposals: [
        {
          agentId: 'a1',
          domain: 'general',
          summary: '',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [],
          confidence: 0.2,
        },
      ],
      gatingQuestions: [],
      criticalQuestions: [],
      contextPack,
      activeSpecialist: {
        id: 'dietista',
        displayName: 'Dietista',
        domain: 'nutrition',
      },
    })

    expect(result).toEqual({ rawText: 'Come posso aiutarti?', fallbackUsed: true })
  })
})
