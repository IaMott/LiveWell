export type FinalAnswerInput = {
  rawText: string
  criticalQuestions: string[]
}

export type FinalAnswerResult = {
  finalText: string
  appendedCriticalQuestion: boolean
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

  const missingQuestion = input.criticalQuestions.find(
    (question) => !hasEquivalentQuestionInText(input.rawText, question),
  )

  if (!missingQuestion) {
    return { finalText: input.rawText, appendedCriticalQuestion: false }
  }

  return {
    finalText: `${input.rawText.trim()}\n\nMi manca solo questo dato per risponderti meglio: ${missingQuestion}`,
    appendedCriticalQuestion: true,
  }
}
