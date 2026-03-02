import type { ConversationContext, AIMessage, Domain, InterviewState } from './types'
import { classifyDomain } from './orchestrator'

/**
 * Build conversation context from message history.
 * Analyzes messages to determine domain, interview state, and known/missing data.
 */
export function buildContext(
  messages: AIMessage[],
  userId: string,
  existingDomain?: Domain,
): ConversationContext {
  // Determine domain from latest user message or existing
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const domain = existingDomain || (lastUserMsg ? classifyDomain(lastUserMsg.content) : 'generale')

  // Count conversation turns
  const userMessages = messages.filter((m) => m.role === 'user')
  const turnCount = userMessages.length

  // Estimate interview state based on turn count
  let interviewState: InterviewState = 'S0'
  if (turnCount >= 1) interviewState = 'S0'
  if (turnCount >= 2) interviewState = 'S1'
  if (turnCount >= 3) interviewState = 'S2'
  if (turnCount >= 5) interviewState = 'S3'
  if (turnCount >= 7) interviewState = 'S4'
  if (turnCount >= 9) interviewState = 'S5'

  // Extract known data from conversation (basic extraction)
  const knownData: Record<string, string> = {}
  const missingData: string[] = []

  // Simple keyword-based extraction from user messages
  for (const msg of userMessages) {
    const content = msg.content.toLowerCase()

    // Extract age
    const ageMatch = content.match(/(\d{1,2})\s*anni/)
    if (ageMatch) knownData['età'] = ageMatch[1]

    // Extract weight
    const weightMatch = content.match(/(\d{2,3})\s*(?:kg|chili|kili)/)
    if (weightMatch) knownData['peso'] = `${weightMatch[1]} kg`

    // Extract height
    const heightMatch = content.match(/(\d{3})\s*(?:cm|centimetri)|(?:alto|alta)\s+(\d)[.,](\d{2})/)
    if (heightMatch) {
      knownData['altezza'] = heightMatch[1]
        ? `${heightMatch[1]} cm`
        : `${heightMatch[2]}.${heightMatch[3]} m`
    }

    // Extract training frequency
    const freqMatch = content.match(/(\d)\s*(?:volte|giorni)(?:\s*(?:a|alla|per)\s*settimana)/)
    if (freqMatch) knownData['frequenza_allenamento'] = `${freqMatch[1]} volte/settimana`

    // Detect goals
    if (content.includes('dimagrire') || content.includes('perdere peso')) {
      knownData['obiettivo'] = 'perdita peso'
    } else if (content.includes('massa') || content.includes('muscoli')) {
      knownData['obiettivo'] = 'aumento massa muscolare'
    } else if (content.includes('salute') || content.includes('stare bene')) {
      knownData['obiettivo'] = 'benessere generale'
    }
  }

  // Determine missing data based on domain
  if (domain === 'nutrizione') {
    if (!knownData['obiettivo']) missingData.push('obiettivo principale')
    if (!knownData['peso']) missingData.push('peso attuale')
    if (!knownData['altezza']) missingData.push('altezza')
    if (!knownData['età']) missingData.push('età')
  } else if (domain === 'allenamento') {
    if (!knownData['obiettivo']) missingData.push('obiettivo principale')
    if (!knownData['frequenza_allenamento']) missingData.push('frequenza allenamento settimanale')
  }

  return {
    messages,
    domain,
    interviewState,
    knownData,
    missingData,
    riskSignal: 'none',
    userId,
  }
}
