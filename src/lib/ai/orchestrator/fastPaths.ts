import { AgentInput, ConsensusResult } from '../types'
import {
  ageFromIsoDate,
  inferAttributeToolCallsFromMessage,
  isAgeQuestion,
  readPersonalSnapshot,
} from './inputInference'
import { detectDomainFromText } from '../domain/domainDetection'

export type FastPathResult = { handled: true; result: ConsensusResult } | { handled: false }

/** Pure greeting patterns — no topic or domain signal */
const GREETING_PATTERNS = [
  /^(ciao|salve|buongiorno|buonasera|buonanotte|hey|hello|hi|hola|salut)[!.,\s]*$/i,
  /^(ciao\s+a\s+tutti|ciao\s+raga|ciao\s+a\s+te)[!.,\s]*$/i,
]

/**
 * M1: Mid-conversation filler patterns — short acknowledgements with no informational content.
 * These appear in the middle of a conversation (hasHistory=true) and should skip agent rounds
 * to avoid specialists treating "ok" as a topic trigger.
 */
const FILLER_PATTERNS = [
  /^(ok|okay|va bene|va benissimo|perfetto|ottimo|capito|ho capito|grazie|thanks|thank you|👍|✅)[!.,\s]*$/i,
  /^(sì|si|no|certo|esatto|giusto|esattamente|assolutamente)[!.,\s]*$/i,
  /^(continua|prosegui|dimmi|dimmi pure|e poi|poi)[!.,\s]*$/i,
]

function isGenericGreeting(message: string): boolean {
  const trimmed = message.trim()
  return GREETING_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function isMidConversationFiller(message: string): boolean {
  const trimmed = message.trim()
  return FILLER_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/**
 * Fast-path for pure greetings / domain-less short messages.
 * When there's no domain signal, skip the entire agent pipeline
 * so no specialist gets injected into synthesis.
 * Returns { handled: false } so the orchestrator still runs synthesis,
 * but marks proposals as empty to avoid agent contamination.
 *
 * NOTE: This fast-path does NOT return a final ConsensusResult — it signals
 * the orchestrator to skip agent rounds and go straight to synthesis with
 * empty proposals. We do this by returning handled:false + setting a flag
 * via a separate exported function checked in orchestrator.ts.
 */
export function isGenericMessage(input: AgentInput): boolean {
  const trimmed = input.message.trim()
  // Greeting (first message or mid-conversation)
  if (isGenericGreeting(trimmed)) return true
  // M1: Mid-conversation filler — "ok", "grazie", "perfetto" etc. with no domain signal.
  // Only applies when there IS history (otherwise the short-message guard below handles it).
  const hasHistory = input.contextPack.history.recentMessages.length > 0
  if (hasHistory && isMidConversationFiller(trimmed)) return true
  // Very short (≤4 words), no domain keywords, no history
  const wordCount = trimmed.split(/\s+/).length
  const hasNoHistory = !hasHistory
  const detectedDomain = detectDomainFromText(trimmed)
  if (wordCount <= 4 && hasNoHistory && detectedDomain === 'general') return true
  return false
}

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
            displayName: input.activeSpecialistId
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' '),
            domain: 'general',
          }
        : undefined,
      debug: { selectedAgents: [], conflicts: [] },
    },
  }
}
