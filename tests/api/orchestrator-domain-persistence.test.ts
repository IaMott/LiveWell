import { describe, expect, it } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentProfile, ContextPack } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'fisioterapista',
    displayName: 'Fisioterapista',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
  {
    id: 'psicologo',
    displayName: 'Psicologo',
    domainTags: ['mindfulness'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
]

const contextPack: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

describe('orchestrator deterministic domain persistence', () => {
  it('keeps pending interview questions across turns and asks one at a time', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'Procediamo.' }
        return {
          text: JSON.stringify({
            domain: 'nutrition',
            summary: 'ok',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const withPending: ContextPack = {
      ...contextPack,
      history: {
        ...contextPack.history,
        agentWorkspaces: [
          {
            agentId: 'fisioterapista',
            round2Summary: 'pending',
            pendingDomain: 'nutrition',
            pendingQuestions: [
              'Hai allergie o intolleranze alimentari da registrare?',
              'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
            ],
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-queue',
        userId: 'u1',
        conversationId: 'c1',
        message: 'continuiamo con la nutrizione',
        domainHint: 'nutrition',
        contextPack: withPending,
      },
    )

    expect(out.gatingQuestions).toEqual(['Hai allergie o intolleranze alimentari da registrare?'])
    const r2 = out.debug?.round2Proposals?.[0]
    expect(r2?.pendingQuestions).toEqual([
      'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
    ])
    expect(r2?.pendingDomain).toBe('nutrition')
  })

  it('preserves the original workspace queue order even when policy ranking would prefer another question', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'Procediamo.' }
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: 'ok',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const withPending: ContextPack = {
      ...contextPack,
      history: {
        ...contextPack.history,
        agentWorkspaces: [
          {
            agentId: 'fisioterapista',
            round2Summary: 'pending',
            pendingDomain: 'health',
            pendingQuestions: [
              'Hai già una diagnosi medica confermata o esami recenti disponibili?',
              'Da quanto tempo è presente il sintomo principale?',
            ],
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-queue-order',
        userId: 'u1',
        conversationId: 'c1',
        message: 'continuiamo con la salute',
        domainHint: 'health',
        contextPack: withPending,
      },
    )

    expect(out.gatingQuestions).toEqual([
      'Hai già una diagnosi medica confermata o esami recenti disponibili?',
    ])
    const r2 = out.debug?.round2Proposals?.[0]
    expect(r2?.pendingQuestions).toEqual(['Da quanto tempo è presente il sintomo principale?'])
  })

  it('does not append duplicated integration question when already asked in response body', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') {
          return {
            text: 'Per procedere, hai allergie o intolleranze alimentari da registrare?',
          }
        }
        return {
          text: JSON.stringify({
            domain: 'nutrition',
            summary: 'ok',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-nodup',
        userId: 'u1',
        conversationId: 'c1',
        domainHint: 'nutrition',
        message: 'continuiamo con la nutrizione',
        contextPack,
      },
    )

    expect(out.finalMessageMarkdown).not.toContain(
      'Mi manca solo questo dato per risponderti meglio',
    )
    expect(out.gatingQuestions?.length).toBeLessThanOrEqual(1)
  })

  it('answers age question directly when birthDate exists and asks only DOB when missing', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'mock text' }
        return {
          text: JSON.stringify({
            domain: 'general',
            summary: 'mock',
            reasoning: 'mock',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const withDob: ContextPack = {
      ...contextPack,
      user: {
        ...contextPack.user,
        profile: { birthDate: '1991-06-26' },
      },
    }
    const outKnown = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-age-known',
        userId: 'u1',
        conversationId: 'c1',
        message: 'Quanti anni ho?',
        contextPack: withDob,
      },
    )
    expect(outKnown.finalMessageMarkdown).toMatch(/Hai \d+ anni\./)
    expect((outKnown.gatingQuestions ?? []).length).toBe(0)

    const outMissing = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-age-missing',
        userId: 'u1',
        conversationId: 'c1',
        message: 'Quanti anni ho?',
        contextPack,
      },
    )
    expect(outMissing.finalMessageMarkdown.toLowerCase()).toContain('data di nascita')
    expect(outMissing.gatingQuestions).toEqual([
      'Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).',
    ])
  })

  it('infers mindfulness attributes from natural chat when agents do not emit tool calls', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'Ti aiuto volentieri.' }
        return {
          text: JSON.stringify({
            domain: 'mindfulness',
            summary: 'Capito.',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.7,
          }),
        }
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-mind',
        userId: 'u1',
        conversationId: 'c1',
        message: 'in mindfulness ho stress 8 su 10 e dormo 5 ore',
        contextPack,
      },
    )

    const calls = out.toolCallsToExecute.filter((c) => c.name === 'user.setAttribute')
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(calls.some((c) => JSON.stringify(c.args).includes('stress_level'))).toBe(true)
    expect(calls.some((c) => JSON.stringify(c.args).includes('sleep_hours'))).toBe(true)
  })

  it('infers nutrition allergy from "allergico alle ..." phrasing', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'Ricevuto.' }
        return {
          text: JSON.stringify({
            domain: 'nutrition',
            summary: 'ok',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.7,
          }),
        }
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-nut',
        userId: 'u1',
        conversationId: 'c1',
        message: 'in nutrizione sono allergico alle nocciole',
        contextPack,
      },
    )

    expect(
      out.toolCallsToExecute.some(
        (c) =>
          c.name === 'user.setAttribute' &&
          JSON.stringify(c.args).includes('"domain":"nutrition"') &&
          JSON.stringify(c.args).includes('"key":"allergy"') &&
          JSON.stringify(c.args).toLowerCase().includes('nocciole'),
      ),
    ).toBe(true)
  })

  it('does not ask generic priority question in locked specialist mode', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        if (format === 'text') return { text: 'Sono il fisioterapista, iniziamo.' }
        return {
          text: JSON.stringify({
            domain: 'training',
            summary: 'Sono il fisioterapista.',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.7,
          }),
        }
      },
    }

    const out = await orchestrate(
      { llm, team, orchestratorToolsAllowed: ['user.setAttribute'] },
      {
        requestId: 'r-spec',
        userId: 'u1',
        conversationId: 'c1',
        message: 'voglio parlare con il fisioterapista',
        activeSpecialistId: 'fisioterapista',
        contextPack,
      },
    )

    const mergedQuestions = out.gatingQuestions ?? []
    expect(
      mergedQuestions.some((q) => q.toLowerCase().includes('quale area vuoi prioritizzare adesso')),
    ).toBe(false)
  })
})
