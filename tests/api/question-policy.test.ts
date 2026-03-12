import { describe, expect, it } from 'vitest'
import { applyQuestionPolicy } from '@/lib/ai/policy/questionPolicy'

describe('question policy engine', () => {
  it('deduplicates equivalent candidate questions', () => {
    const out = applyQuestionPolicy(
      [
        { question: 'Hai allergie o intolleranze alimentari da registrare?' },
        { question: 'Hai intolleranze o allergie alimentari da registrare?' },
      ],
      { domain: 'nutrition', maxQuestions: 1, dedupeStrategy: 'semantic' },
    )

    expect(out.orderedQuestions).toHaveLength(1)
    expect(out.discardedQuestions.some((item) => item.reason === 'duplicate')).toBe(true)
  })

  it('filters generic questions', () => {
    const out = applyQuestionPolicy(
      [
        { question: 'C’è qualcos’altro che desideri aggiungere?' },
        { question: 'Da quanto tempo hai dolore?' },
      ],
      { domain: 'health', maxQuestions: 1, dedupeStrategy: 'semantic' },
    )

    expect(out.orderedQuestions).toEqual(['Da quanto tempo hai dolore?'])
    expect(out.discardedQuestions).toContainEqual({
      question: 'C’è qualcos’altro che desideri aggiungere?',
      reason: 'generic',
    })
  })

  it('keeps at most one selected question per turn', () => {
    const out = applyQuestionPolicy(
      [
        { question: 'Da quanto tempo hai dolore?' },
        { question: 'Hai già una diagnosi medica confermata o esami recenti disponibili?' },
      ],
      { domain: 'health', maxQuestions: 1, dedupeStrategy: 'semantic' },
    )

    expect(out.selectedQuestions).toHaveLength(1)
    expect(out.orderedQuestions).toHaveLength(2)
    expect(out.discardedQuestions.some((item) => item.reason === 'max-per-turn')).toBe(true)
  })

  it('applies coherent priority across candidate questions', () => {
    const out = applyQuestionPolicy(
      [
        { question: 'Hai già una diagnosi medica confermata o esami recenti disponibili?' },
        { question: 'Da quanto tempo hai dolore?' },
      ],
      { domain: 'health', maxQuestions: 1, dedupeStrategy: 'semantic' },
    )

    expect(out.selectedQuestions).toEqual(['Da quanto tempo hai dolore?'])
  })

  it('filters questions already satisfied by known profile or attributes', () => {
    const out = applyQuestionPolicy(
      [
        { question: 'Hai già una diagnosi?' },
        { question: 'Quanti anni hai?' },
        { question: 'Da quanto tempo hai dolore?' },
      ],
      {
        domain: 'health',
        maxQuestions: 1,
        dedupeStrategy: 'semantic',
        knownData: {
          profile: { age: 34 },
          attributes: {
            health: { diagnosis: { value: 'lombalgia' } },
          },
        },
      },
    )

    expect(out.selectedQuestions).toEqual(['Da quanto tempo hai dolore?'])
    expect(out.orderedQuestions).toEqual(['Da quanto tempo hai dolore?'])
  })
})
