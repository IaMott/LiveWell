import { describe, expect, it } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentProfile, ContextPack } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.updateProfile'],
    decisionStyle: 'team-led',
  },
  {
    id: 'fisioterapista',
    displayName: 'Fisioterapista',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.updateProfile'],
    decisionStyle: 'team-led',
  },
]

const baseContext: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

describe('orchestrator multi-round', () => {
  it('returns round1 and round2 proposals in debug payload', async () => {
    const llm = {
      complete: async ({ user }: { system: string; user: string }) => {
        const isRound2 = user.includes('PEER REVIEW (round 2)')
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: isRound2 ? 'round2 summary' : 'round1 summary',
            reasoning: 'ok',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.updateProfile'],
      },
      {
        requestId: 'r1',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ho dolore alla schiena',
        contextPack: baseContext,
      },
    )

    expect(result.debug?.round1Proposals?.length).toBeGreaterThan(0)
    expect(result.debug?.round2Proposals?.length).toBeGreaterThan(0)
  })

  it('does not retry non-retriable tool calls from recent toolExecutionTrace', async () => {
    const llm = {
      complete: async () => ({
        text: JSON.stringify({
          domain: 'health',
          summary: 'ok',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [
            {
              id: 'tc-retry',
              name: 'user.updateProfile',
              args: { fields: { weight: 80 } },
            },
          ],
          confidence: 0.9,
        }),
      }),
    }

    const contextWithRecentFailure: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        toolExecutionTrace: [
          {
            toolCallId: 'tc-old',
            name: 'user.updateProfile',
            ok: false,
            code: 'FORBIDDEN',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.updateProfile'],
      },
      {
        requestId: 'r2',
        userId: 'u1',
        conversationId: 'c1',
        message: 'aggiorna il mio peso',
        contextPack: contextWithRecentFailure,
      },
    )

    expect(result.toolCallsToExecute).toEqual([])
    expect(
      result.debug?.conflicts?.some((c) => c.includes('Blocked 1 non-retriable tool call')),
    ).toBe(true)
    expect(result.debug?.blockedToolCalls?.length).toBe(1)
    expect(result.debug?.blockedToolCalls?.[0]?.name).toBe('user.updateProfile')
  })

  it('allows retry when previous non-retriable failure is outside retry-guard window', async () => {
    const llm = {
      complete: async () => ({
        text: JSON.stringify({
          domain: 'health',
          summary: 'ok',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [
            {
              id: 'tc-old-window',
              name: 'user.updateProfile',
              args: { fields: { weight: 81 } },
            },
          ],
          confidence: 0.9,
        }),
      }),
    }

    const oldFailure = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const contextWithOldFailure: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        toolExecutionTrace: [
          {
            toolCallId: 'tc-fail-old',
            name: 'user.updateProfile',
            ok: false,
            code: 'FORBIDDEN',
            createdAt: oldFailure,
          },
        ],
      },
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.updateProfile'],
      },
      {
        requestId: 'r3',
        userId: 'u1',
        conversationId: 'c1',
        message: 'riprova ad aggiornare il peso',
        contextPack: contextWithOldFailure,
      },
    )

    expect(result.toolCallsToExecute.length).toBeGreaterThan(0)
    expect(result.toolCallsToExecute[0]?.name).toBe('user.updateProfile')
    expect(result.debug?.blockedToolCalls?.length ?? 0).toBe(0)
  })

  it('uses retryGuardWindowMs override from deps when evaluating retry guard', async () => {
    const llm = {
      complete: async () => ({
        text: JSON.stringify({
          domain: 'health',
          summary: 'ok',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [
            {
              id: 'tc-env-window',
              name: 'user.updateProfile',
              args: { fields: { weight: 82 } },
            },
          ],
          confidence: 0.9,
        }),
      }),
    }

    const failureAt5000ms = new Date(Date.now() - 5000).toISOString()
    const contextWithFailure: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        toolExecutionTrace: [
          {
            toolCallId: 'tc-fail-env',
            name: 'user.updateProfile',
            ok: false,
            code: 'FORBIDDEN',
            createdAt: failureAt5000ms,
          },
        ],
      },
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.updateProfile'],
        retryGuardWindowMs: 1000,
      },
      {
        requestId: 'r4',
        userId: 'u1',
        conversationId: 'c1',
        message: 'riprova ad aggiornare il peso',
        contextPack: contextWithFailure,
      },
    )

    expect(result.toolCallsToExecute.length).toBeGreaterThan(0)
    expect(result.toolCallsToExecute[0]?.name).toBe('user.updateProfile')
    expect(result.debug?.blockedToolCalls?.length ?? 0).toBe(0)
  })
})
