import { describe, expect, it } from 'vitest'
import { applyInterviewFlow } from '@/lib/ai/orchestrator/interviewFlow'
import type { AgentProposal, ContextPack } from '@/lib/ai/types'

const baseContext: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

const baseRound2Proposals: AgentProposal[] = [
  {
    agentId: 'dietista',
    domain: 'nutrition',
    summary: 'ok',
    reasoning: 'ok',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0.8,
  },
  {
    agentId: 'gastroenterologo',
    domain: 'nutrition',
    summary: 'ok',
    reasoning: 'ok',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0.7,
  },
]

describe('interview flow boundary', () => {
  it('returns one current question and preserves workspace queue order in pendingNext', () => {
    const contextPack: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        agentWorkspaces: [
          {
            agentId: 'dietista',
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

    const result = applyInterviewFlow({
      domain: 'nutrition',
      contextPack,
      userMessage: 'continuiamo con la nutrizione',
      consensusGatingQuestions: [],
      round2Proposals: baseRound2Proposals,
    })

    expect(result.finalInterviewQuestions).toEqual([
      'Hai allergie o intolleranze alimentari da registrare?',
    ])
    expect(result.round2WithQueue[0]?.pendingQuestions).toEqual([
      'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
    ])
    expect(result.round2WithQueue[0]?.pendingDomain).toBe('nutrition')
    expect(result.round2ForPersistence).toEqual(result.round2WithQueue)
  })

  it('asks all questions upfront on first domain interaction (no workspace, no attributes)', () => {
    // When profile is empty and no pending questions queued, maxAskNow=3 → all questions at once
    const result = applyInterviewFlow({
      domain: 'nutrition',
      contextPack: baseContext,
      userMessage: 'voglio lavorare sulla nutrizione',
      consensusGatingQuestions: [],
      round2Proposals: [],
      activeSpecialist: {
        id: 'dietista',
        displayName: 'Dietista',
        domain: 'nutrition',
      },
    })

    expect(result.finalInterviewQuestions).toContain(
      'Hai allergie o intolleranze alimentari da registrare?',
    )
    expect(result.finalInterviewQuestions).toContain(
      'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
    )
    expect(result.round2WithQueue).toEqual([])
    // No pendingNext when all asked at once → no synthetic persistence proposal needed
    expect(result.round2ForPersistence).toEqual([])
  })

  it('keeps digestive follow-ups focused during an active specialist case instead of reopening nutrition intake', () => {
    const contextPack: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        recentMessages: [
          {
            role: 'user',
            content: 'Ho gastrite, reflusso e rutti dopo i pasti',
            createdAt: '2026-03-21T08:00:00.000Z',
          },
          {
            role: 'assistant',
            content: 'Capito, continuiamo sul problema digestivo.',
            createdAt: '2026-03-21T08:00:10.000Z',
          },
        ],
      },
    }

    const result = applyInterviewFlow({
      domain: 'nutrition',
      contextPack,
      userMessage: 'vorrei capire come mangiare senza peggiorare il reflusso',
      consensusGatingQuestions: [],
      round2Proposals: baseRound2Proposals,
      activeSpecialist: {
        id: 'dietista',
        displayName: 'Dietista',
        domain: 'nutrition',
      },
    })

    expect(result.finalInterviewQuestions).toEqual([
      'Hai notato alimenti, bevande o orari dei pasti che peggiorano i sintomi digestivi?',
    ])
    expect(result.finalInterviewQuestions.join(' ')).not.toMatch(
      /obiettivo nutrizionale|allergie|pasti nella giornata/i,
    )
  })

  it('keeps pain follow-ups focused during sport-related cases instead of reopening training intake', () => {
    const contextPack: ContextPack = {
      ...baseContext,
      history: {
        ...baseContext.history,
        recentMessages: [
          {
            role: 'user',
            content: 'Mi fa male il ginocchio quando corro e sto prendendo ibuprofene',
            createdAt: '2026-03-21T08:00:00.000Z',
          },
        ],
      },
    }

    const result = applyInterviewFlow({
      domain: 'health',
      contextPack,
      userMessage: 'mi alleno ancora ma il dolore torna sempre',
      consensusGatingQuestions: [],
      round2Proposals: [],
      activeSpecialist: {
        id: 'fisioterapista',
        displayName: 'Fisioterapista',
        domain: 'health',
      },
    })

    expect(result.finalInterviewQuestions).toHaveLength(1)
    expect(result.finalInterviewQuestions[0]).toMatch(/dolore|problema fisico/i)
    expect(result.finalInterviewQuestions.join(' ')).not.toMatch(
      /allenamenti a settimana|limitazioni fisiche/i,
    )
  })

  it('does not reopen L1 baseline on a rich multi-signal dirty case', () => {
    const result = applyInterviewFlow({
      domain: 'coordination',
      contextPack: baseContext,
      userMessage: 'lavoro male, dormo poco, sono in ansia e non riesco a organizzarmi',
      consensusGatingQuestions: [],
      round2Proposals: [],
    })

    expect(result.finalInterviewQuestions.join(' ')).not.toMatch(
      /come ti chiami|quanti anni|sesso biologico/i,
    )
  })
})
