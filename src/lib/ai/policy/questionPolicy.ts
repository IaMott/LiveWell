import { Domain } from '../types'

export type QuestionCandidate = {
  question: string
  priority?: number
}

export type QuestionPolicyDiscardReason =
  | 'empty'
  | 'generic'
  | 'known-data'
  | 'duplicate'
  | 'max-per-turn'

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
  knownData?: KnownQuestionData
}

export type KnownQuestionData = {
  profile?: Record<string, unknown>
  attributes?: Partial<Record<string, Record<string, unknown>>>
}

type KnownProfileFieldHint = {
  keywords: string[]
  fieldPath: string
}

type KnownAttributeFieldHint = {
  keywords: string[]
  domain: string
  key: string
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

const DEFAULT_PROFILE_FIELD_HINTS: KnownProfileFieldHint[] = [
  { keywords: ['età', 'anni', 'age', 'quanti anni', 'how old'], fieldPath: 'age' },
  { keywords: ['peso', 'kg', 'chili', 'weight', 'quanti kg', 'quanti chili'], fieldPath: 'weight' },
  { keywords: ['altezza', 'cm', 'height', 'quanto sei alto', 'how tall'], fieldPath: 'height' },
  { keywords: ['obiettivo', 'goal', 'scopo', 'cosa vuoi'], fieldPath: 'goals' },
  {
    keywords: ['sesso', 'genere', 'gender', 'uomo', 'donna', 'male', 'female'],
    fieldPath: 'gender',
  },
]

const DEFAULT_ATTRIBUTE_FIELD_HINTS: KnownAttributeFieldHint[] = [
  { keywords: ['peso', 'weight', 'kg'], domain: 'personal', key: 'weight' },
  { keywords: ['altezza', 'height', 'cm'], domain: 'personal', key: 'height' },
  { keywords: ['diagnosi', 'diagnosis', 'patologia'], domain: 'health', key: 'diagnosis' },
  { keywords: ['farmaco', 'medicazione', 'medication'], domain: 'health', key: 'medication' },
  { keywords: ['allergia', 'allergy'], domain: 'health', key: 'allergy' },
  { keywords: ['infortunio', 'injury', 'lesione'], domain: 'health', key: 'injury' },
  { keywords: ['dieta', 'diet', 'regime alimentare'], domain: 'nutrition', key: 'diet' },
  { keywords: ['obiettivo', 'goal'], domain: 'general', key: 'goal' },
]

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

export function filterKnownDataQuestions(
  questions: string[],
  knownData?: KnownQuestionData,
  profileHints: KnownProfileFieldHint[] = DEFAULT_PROFILE_FIELD_HINTS,
  attributeHints: KnownAttributeFieldHint[] = DEFAULT_ATTRIBUTE_FIELD_HINTS,
): string[] {
  const profile = knownData?.profile ?? {}
  const attributes = knownData?.attributes ?? {}

  return questions.filter((question) => {
    const normalizedQuestion = normalizeWhitespace(question).toLowerCase()

    for (const { keywords, fieldPath } of profileHints) {
      if (!keywords.some((keyword) => normalizedQuestion.includes(keyword))) continue
      if (profile[fieldPath] != null) return false
    }

    for (const { keywords, domain, key } of attributeHints) {
      if (!keywords.some((keyword) => normalizedQuestion.includes(keyword))) continue
      const domainAttributes = attributes[domain]
      if (domainAttributes?.[key] != null) return false
    }

    return true
  })
}

export function applyQuestionPolicy(
  candidates: QuestionCandidate[],
  options: QuestionPolicyOptions,
): QuestionPolicyResult {
  const maxQuestions = options.maxQuestions ?? 1
  const dedupeStrategy = options.dedupeStrategy ?? 'semantic'
  const hints = DOMAIN_PRIORITY_HINTS[options.domain] ?? DOMAIN_PRIORITY_HINTS.general
  const filteredCandidates = filterKnownDataQuestions(
    candidates.map((candidate) => candidate.question),
    options.knownData,
  )
  const allowedQuestions = new Set(
    filteredCandidates.map((question) => normalizeWhitespace(question).toLowerCase()),
  )

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

    if (!allowedQuestions.has(question.toLowerCase())) {
      discardedQuestions.push({ question, reason: 'known-data' })
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
