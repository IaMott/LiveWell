import { describe, expect, it } from 'vitest'
import { hardenFinalAnswer } from '@/lib/ai/orchestrator/finalAnswer'

describe('final answer hardening boundary', () => {
  it('returns the original text when there are no critical questions', () => {
    expect(
      hardenFinalAnswer({
        rawText: 'Risposta finale.',
        criticalQuestions: [],
      }),
    ).toEqual({
      finalText: 'Risposta finale.',
      appendedCriticalQuestion: false,
    })
  })

  it('does not append a duplicate question when an equivalent question is already present', () => {
    expect(
      hardenFinalAnswer({
        rawText: 'Per procedere, hai allergie o intolleranze alimentari da registrare?',
        criticalQuestions: ['Hai allergie o intolleranze alimentari da registrare?'],
      }),
    ).toEqual({
      finalText: 'Per procedere, hai allergie o intolleranze alimentari da registrare?',
      appendedCriticalQuestion: false,
    })
  })

  it('appends the critical question when it is missing from the response text', () => {
    expect(
      hardenFinalAnswer({
        rawText: 'Ti aiuto volentieri.',
        criticalQuestions: ['Hai allergie o intolleranze alimentari da registrare?'],
      }),
    ).toEqual({
      finalText:
        'Ti aiuto volentieri.\n\nMi manca solo questo dato per risponderti meglio: Hai allergie o intolleranze alimentari da registrare?',
      appendedCriticalQuestion: true,
    })
  })
})
