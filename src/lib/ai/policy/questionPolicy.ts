import { Domain } from '../types'

export type QuestionCandidate = {
  question: string
  priority?: number
}

export type QuestionPolicyDiscardReason = 'empty' | 'generic' | 'duplicate' | 'max-per-turn'

export type QuestionPolicyDecision = {
  question: string
  reason: QuestionPolicyDiscardReason
}

export type QuestionPolicyResult = {
  selectedQuestions: string[]
  orderedQuestions: string[]
  discardedQuestions: QuestionPolicyDecision[]
}

export type QuestionPolicyOptions = {
  domain: Domain
  maxQuestions?: number
  dedupeStrategy?: 'exact' | 'semantic'
}

const BLOCKED_TEMPLATE_PATTERNS: RegExp[] = [
  /quale area vuoi prioritizzare adesso/i,
  /qual[’']?e la tua altezza in cm/i,
  /qual[’']?e il tuo peso attuale in kg/i,
  /c[’']?e qualcos[’']?altro/i,
  /cosa vuoi fare/i,
]

const GENERIC_QUESTION_PATTERNS: RegExp[] = [
  /c['’]e\s+qualcos['’]altro/i,
  /vuoi\s+aggiungere/i,
  /desideri\s+aggiungere/i,
  /come\s+ti\s+senti\s+generalmente/i,
  /come ti senti in generale/i,
  /cosa\s+vuoi\s+fare/i,
  /cosa\s+intendi/i,
  /posso\s+aiutarti/i,
  /come posso aiutarti/i,
  /quale area/i,
]

const DOMAIN_PRIORITY_HINTS: Record<Domain, string[]> = {
  health: ['dolore', 'durata', 'sintomo', 'farmaci', 'diagnosi', 'allerg'],
  nutrition: ['allerg', 'intoller', 'obiettivo', 'pasti', 'aliment'],
  training: ['allen', 'infortun', 'dolore', 'session', 'obiettivo'],
  mindfulness: ['stress', 'sonno', 'ansia', 'umore'],
  inspiration: ['obiettivo', 'progetto', 'piano'],
  coordination: ['obiettivo', 'priorit'],
  general: ['obiettivo', 'dato'],
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeExactKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[?.,!]/g, '')
}

function tokenizeQuestion(value: string): Set<string> {
  return new Set(
    normalizeExactKey(value)
      .split(/\s+/)
      .filter((token) => token.length > 3),
  )
}

function areQuestionsEquivalent(
  left: string,
  right: string,
  strategy: 'exact' | 'semantic',
): boolean {
  if (normalizeExactKey(left) === normalizeExactKey(right)) {
    return true
  }
  if (strategy === 'exact') {
    return false
  }

  const leftTokens = tokenizeQuestion(left)
  const rightTokens = tokenizeQuestion(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return false
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union > 0 && intersection / union > 0.4
}

export function isGenericQuestion(question: string): boolean {
  const trimmed = normalizeWhitespace(question)
  if (!trimmed) return true
  return (
    BLOCKED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    GENERIC_QUESTION_PATTERNS.some((pattern) => pattern.test(trimmed))
  )
}

export function applyQuestionPolicy(
  candidates: QuestionCandidate[],
  options: QuestionPolicyOptions,
): QuestionPolicyResult {
  const maxQuestions = options.maxQuestions ?? 1
  const dedupeStrategy = options.dedupeStrategy ?? 'semantic'
  const hints = DOMAIN_PRIORITY_HINTS[options.domain] ?? DOMAIN_PRIORITY_HINTS.general

  const kept: Array<{ question: string; priority: number; score: number; index: number }> = []
  const discardedQuestions: QuestionPolicyDecision[] = []

  candidates.forEach((candidate, index) => {
    const question = normalizeWhitespace(candidate.question)
    if (!question) {
      discardedQuestions.push({ question: candidate.question, reason: 'empty' })
      return
    }

    if (isGenericQuestion(question)) {
      discardedQuestions.push({ question, reason: 'generic' })
      return
    }

    if (
      kept.some((existing) => areQuestionsEquivalent(existing.question, question, dedupeStrategy))
    ) {
      discardedQuestions.push({ question, reason: 'duplicate' })
      return
    }

    const lower = question.toLowerCase()
    const score = hints.reduce((acc, hint) => (lower.includes(hint) ? acc + 1 : acc), 0)
    kept.push({
      question,
      priority: candidate.priority ?? 0,
      score,
      index,
    })
  })

  kept.sort(
    (left, right) =>
      right.priority - left.priority ||
      right.score - left.score ||
      left.question.length - right.question.length ||
      left.index - right.index,
  )

  const orderedQuestions = kept.map((entry) => entry.question)
  const selectedQuestions = orderedQuestions.slice(0, Math.max(0, maxQuestions))

  orderedQuestions.slice(selectedQuestions.length).forEach((question) => {
    discardedQuestions.push({ question, reason: 'max-per-turn' })
  })

  return {
    selectedQuestions,
    orderedQuestions,
    discardedQuestions,
  }
}
