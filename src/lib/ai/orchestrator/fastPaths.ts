import { AgentInput, ConsensusResult } from '../types'
import {
  ageFromIsoDate,
  inferAttributeToolCallsFromMessage,
  isAgeQuestion,
  readPersonalSnapshot,
} from './inputInference'

export type FastPathResult = { handled: true; result: ConsensusResult } | { handled: false }

export function tryAgeQuestionFastPath(input: AgentInput): FastPathResult {
  if (!isAgeQuestion(input.message)) return { handled: false }

  const personal = readPersonalSnapshot(input.contextPack)
  const age = personal.birthDate ? ageFromIsoDate(personal.birthDate) : null
  const response =
    age != null
      ? `Hai ${age} anni.`
      : 'Non ho la tua data di nascita registrata. Per calcolare la tua età indicami la data di nascita in formato gg/mm/aaaa.'

  return {
    handled: true,
    result: {
      domain: 'general',
      finalMessageMarkdown: response,
      toolCallsToExecute: inferAttributeToolCallsFromMessage(input.message, {
        domainHint: 'general',
      }),
      ui: {
        domainIcon: 'general',
        moodScore: input.contextPack.ui.moodScore,
        sectionScores: input.contextPack.ui.sectionScores,
      },
      gatingQuestions:
        age == null
          ? ['Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).']
          : undefined,
      safety: { escalation: 'none' },
      artifactsToSave: undefined,
      activeSpecialist: input.activeSpecialistId
        ? {
            id: input.activeSpecialistId,
            displayName: input.activeSpecialistId,
            domain: 'general',
          }
        : undefined,
      debug: { selectedAgents: [], conflicts: [] },
    },
  }
}
