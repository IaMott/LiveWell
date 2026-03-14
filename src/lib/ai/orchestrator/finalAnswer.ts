export type FinalAnswerInput = {
  rawText: string
  criticalQuestions: string[]
  userMessage?: string
}

export type FinalAnswerResult = {
  finalText: string
  appendedCriticalQuestion: boolean
}

// Patterns indicating the user wants proactive advice, not more questions
const PROACTIVE_DEMAND_PATTERNS = [
  /dovresti\s+dirmelo/i,
  /ditemi\s+voi/i,
  /non\s+devo\s+dirvi/i,
  /analizzat[ei]mi/i,
  /analizzate\s+voi/i,
  /voi\s+dovete/i,
  /datemi\s+consigli/i,
  /prendete\s+iniziativa/i,
  /decidete\s+voi/i,
  /cosa\s+è\s+meglio\s+per\s+me/i,
  /ditemi\s+cosa\s+fare/i,
]

function isUserDemandingDirectAdvice(userMessage: string): boolean {
  return PROACTIVE_DEMAND_PATTERNS.some((pattern) => pattern.test(userMessage))
}

function hasEquivalentQuestionInText(text: string, question: string): boolean {
  const clean = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4)

  const textTokens = new Set(clean(text))
  const questionTokens = clean(question)
  if (questionTokens.length === 0) return false

  const overlap = questionTokens.filter((token) => textTokens.has(token)).length
  return overlap >= Math.max(2, Math.ceil(questionTokens.length * 0.5))
}

export function hardenFinalAnswer(input: FinalAnswerInput): FinalAnswerResult {
  if (input.criticalQuestions.length === 0) {
    return { finalText: input.rawText, appendedCriticalQuestion: false }
  }

  // Don't append questions if the user is explicitly asking for direct advice
  if (input.userMessage && isUserDemandingDirectAdvice(input.userMessage)) {
    return { finalText: input.rawText, appendedCriticalQuestion: false }
  }

  // Don't append questions if the response is already substantive (contains advice, not just questions)
  const responseAlreadyHasAdvice =
    input.rawText.length > 150 && (input.rawText.match(/\?/g) ?? []).length <= 2

  if (responseAlreadyHasAdvice) {
    return { finalText: input.rawText, appendedCriticalQuestion: false }
  }

  const missingQuestion = input.criticalQuestions.find(
    (question) => !hasEquivalentQuestionInText(input.rawText, question),
  )

  if (!missingQuestion) {
    return { finalText: input.rawText, appendedCriticalQuestion: false }
  }

  return {
    finalText: `${input.rawText.trim()}\n\nPer personalizzare meglio il piano: ${missingQuestion}`,
    appendedCriticalQuestion: true,
  }
}
