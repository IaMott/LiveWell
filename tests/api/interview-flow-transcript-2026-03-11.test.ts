import { describe, expect, it } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentProfile, ContextPack } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'dietista',
    displayName: 'Dietista',
    domainTags: ['nutrition'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute', 'user.updateProfile'],
    decisionStyle: 'team-led',
  },
  {
    id: 'gastroenterologo',
    displayName: 'Gastroenterologo',
    domainTags: ['health', 'nutrition'],
    systemPrompt: 'x',
    toolsAllowed: ['user.setAttribute', 'user.updateProfile'],
    decisionStyle: 'team-led',
  },
]

const transcriptLikeContext: ContextPack = {
  user: {
    id: 'u1',
    role: 'USER',
    profile: {
      health: { conditions: 'gastrite' },
      birthDate: null,
      weight: null,
      height: null,
    },
  },
  history: {
    recentMessages: [
      { role: 'user', content: 'sono nato il 26/06/1991', createdAt: '2026-03-11T11:06:25.316Z' },
      {
        role: 'assistant',
        content:
          'Grazie per aver condiviso la tua data di nascita. C’è un obiettivo specifico o un aspetto della tua salute?',
        createdAt: '2026-03-11T11:06:25.512Z',
      },
    ],
    recentArtifacts: [],
  },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

describe('interview flow hardening — transcript 2026-03-11', () => {
  it('asks only targeted baseline questions and never generic follow-ups', async () => {
    const llm = {
      complete: async ({ format }: { system: string; user: string; format?: 'json' | 'text' }) => {
        // Simulate weak generic behavior from model: orchestrator must harden output.
        if (format === 'text') {
          return {
            text: 'Capisco. C’è qualcos’altro che desideri aggiungere?',
          }
        }
        return {
          text: JSON.stringify({
            domain: 'nutrition',
            summary: 'Possiamo iniziare a impostare la dieta.',
            reasoning: 'ok',
            questions: ['C’è qualcos’altro che desideri aggiungere?'],
            recommendations: [],
            toolCalls: [],
            confidence: 0.7,
          }),
        }
      },
    }

    const result = await orchestrate(
      {
        llm,
        team,
        orchestratorToolsAllowed: ['user.setAttribute', 'user.updateProfile'],
      },
      {
        requestId: 'r-tx-1',
        userId: 'u1',
        conversationId: 'c1',
        message: 'voglio pianificare la mia dieta',
        contextPack: transcriptLikeContext,
      },
    )

    // Runtime now batches up to 3 baseline fields in one turn when L1 is still incomplete.
    expect((result.gatingQuestions ?? []).length).toBeGreaterThan(0)
    expect((result.gatingQuestions ?? []).length).toBeLessThanOrEqual(3)
    expect((result.gatingQuestions ?? []).every((q) => q.length > 8)).toBe(true)

    // Generic chatty follow-up should not dominate.
    expect(result.gatingQuestions?.some((q) => /qualcos['’]altro|aggiungere/i.test(q))).toBe(false)

    // Final response should include only one integration request.
    expect(result.finalMessageMarkdown).toContain('Per personalizzare meglio il piano:')
  })
})
