import { describe, expect, it } from 'vitest'
import { planToolCalls } from '@/lib/ai/orchestrator/toolCallPlan'
import type { ContextPack, ToolCall } from '@/lib/ai/types'

const baseContext: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

describe('tool call plan boundary', () => {
  it('adds fallback attribute tool calls when consensus does not provide them', () => {
    const result = planToolCalls({
      consensusToolCalls: [],
      message: 'sono nato il 26/06/1991',
      domainHint: 'general',
      contextPack: baseContext,
      retryGuardWindowMs: 60_000,
    })

    const birthCall = result.toolCallsToExecute.find((c) => c.name === 'user.setAttribute')
    expect(birthCall?.args).toMatchObject({
      domain: 'personal',
      key: 'birthDate',
      value: '1991-06-26',
    })
    expect(result.blockedToolCalls).toEqual([])
    expect(result.conflictMessages).toEqual([])
  })

  it('deduplicates consensus and fallback tool calls with the same semantic payload', () => {
    const consensusToolCalls: ToolCall[] = [
      {
        id: 'tc-1',
        name: 'user.setAttribute',
        args: {
          domain: 'personal',
          key: 'birthDate',
          value: '1991-06-26',
          notes: 'Estratto automaticamente da messaggio naturale utente',
        },
      },
    ]

    const result = planToolCalls({
      consensusToolCalls,
      message: 'sono nato il 26/06/1991',
      domainHint: 'general',
      contextPack: baseContext,
      retryGuardWindowMs: 60_000,
    })

    expect(result.toolCallsToExecute).toHaveLength(1)
    expect(result.toolCallsToExecute[0]?.args).toMatchObject({
      domain: 'personal',
      key: 'birthDate',
      value: '1991-06-26',
    })
  })

  it('blocks recent non-retriable tool calls and surfaces the derived conflict', () => {
    const result = planToolCalls({
      consensusToolCalls: [
        {
          id: 'tc-retry',
          name: 'user.updateProfile',
          args: { fields: { weight: 80 } },
        },
      ],
      message: 'aggiorna il mio peso',
      domainHint: 'health',
      contextPack: {
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
      },
      retryGuardWindowMs: 60_000,
    })

    expect(result.toolCallsToExecute).toEqual([])
    expect(result.blockedToolCalls).toHaveLength(1)
    expect(result.blockedToolCalls[0]?.name).toBe('user.updateProfile')
    expect(result.conflictMessages).toEqual([
      'Blocked 1 non-retriable tool call(s) from recent trace',
    ])
  })
})
