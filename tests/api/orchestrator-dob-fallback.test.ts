import { describe, expect, it } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentProfile, ContextPack } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['general', 'health'],
    systemPrompt: 'x',
    toolsAllowed: ['user.updateProfile', 'user.setAttribute'],
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

describe('orchestrator DOB fallback tool-call', () => {
  it('proposes user.setAttribute birthDate when LLM JSON is invalid', async () => {
    const llm = {
      complete: async () => ({
        text: 'Grazie per la condivisione! Ti aiuto subito.',
      }),
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.setAttribute', 'user.updateProfile'],
      },
      {
        requestId: 'r1',
        userId: 'u1',
        conversationId: 'c1',
        message: 'sono nato il 26/06/1991',
        contextPack: baseContext,
      },
    )

    const calls = result.toolCallsToExecute
    expect(calls.length).toBeGreaterThan(0)

    const birthCall = calls.find((c) => c.name === 'user.setAttribute')
    expect(birthCall).toBeTruthy()
    expect(birthCall?.args).toMatchObject({
      domain: 'personal',
      key: 'birthDate',
      value: '1991-06-26',
    })
  })

  it('adds fallback birthDate tool-call when LLM JSON is valid but has empty toolCalls', async () => {
    const llm = {
      complete: async () => ({
        text: JSON.stringify({
          domain: 'health',
          summary: 'Ricevuto, grazie.',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [],
          confidence: 0.7,
        }),
      }),
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.setAttribute', 'user.updateProfile'],
      },
      {
        requestId: 'r2',
        userId: 'u1',
        conversationId: 'c1',
        message: 'la mia data di nascita è 26 giugno 1991',
        contextPack: baseContext,
      },
    )

    const birthCall = result.toolCallsToExecute.find((c) => c.name === 'user.setAttribute')
    expect(birthCall).toBeTruthy()
    expect(birthCall?.args).toMatchObject({
      domain: 'personal',
      key: 'birthDate',
      value: '1991-06-26',
    })
  })
})
