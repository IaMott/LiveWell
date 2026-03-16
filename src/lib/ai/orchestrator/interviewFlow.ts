import { applyQuestionPolicy, isGenericQuestion } from '../policy/questionPolicy'
import { ActiveSpecialist, AgentProposal, ContextPack, Domain } from '../types'
import { isAgeQuestion, readPersonalSnapshot } from './inputInference'

// ---------------------------------------------------------------------------
// 2A — L1 Baseline questions (who is the user)
// ---------------------------------------------------------------------------

function buildL1BaselineQuestions(contextPack: ContextPack, userMessage: string): string[] {
  const personal = readPersonalSnapshot(contextPack)
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()

  // Skip if message already contains specific data (e.g. numbers, symptoms)
  const hasSpecificData =
    /\d/.test(lower) ||
    lower.includes('ho ') ||
    lower.includes('sono ') ||
    lower.includes('soffro') ||
    lower.includes('dolore') ||
    lower.includes('sintomo') ||
    lower.includes('peso') ||
    lower.includes('alleno')
  if (hasSpecificData) return []

  // Skip if we already know age/birthdate
  if (personal.birthDate) return []

  // Check declared goal in general attributes
  const generalAttrs = attrs['general'] as Record<string, { value?: unknown }> | undefined
  const hasDeclaredGoal = Boolean(generalAttrs?.['declared_goal']?.value != null)

  // Max 1 question per turn
  if (!personal.birthDate && !hasDeclaredGoal) {
    return [
      'Per conoscerti meglio: quanti anni hai e come descriveresti la tua situazione attuale?',
    ]
  }
  if (!hasDeclaredGoal) {
    return ['Qual è la cosa più importante che vorresti migliorare o raggiungere?']
  }
  return []
}

// ---------------------------------------------------------------------------
// 2A — L2 Triage questions (what is the main problem)
// ---------------------------------------------------------------------------

function buildL2TriageQuestions(contextPack: ContextPack, userMessage: string): string[] {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()

  // Skip if message already contains specific symptom/domain data
  const hasSpecificContext =
    /\d/.test(lower) ||
    lower.includes('dolore') ||
    lower.includes('sintomo') ||
    lower.includes('problema') ||
    lower.includes('sento') ||
    lower.includes('mangio') ||
    lower.includes('alleno') ||
    lower.includes('soffro') ||
    lower.includes('ho la')
  if (hasSpecificContext) return []

  // Check if main_complaint already known
  const generalAttrs = attrs['general'] as Record<string, { value?: unknown }> | undefined
  const hasMainComplaint = Boolean(generalAttrs?.['main_complaint']?.value != null)

  if (!hasMainComplaint) {
    return ['Qual è il problema principale che senti oggi o su cosa vorresti lavorare?']
  }
  return []
}

export type InterviewFlowInput = {
  domain: Domain
  contextPack: ContextPack
  userMessage: string
  consensusGatingQuestions: string[]
  round2Proposals: AgentProposal[]
  activeSpecialist?: ActiveSpecialist
}

export type InterviewFlowResult = {
  finalInterviewQuestions: string[]
  round2WithQueue: AgentProposal[]
  round2ForPersistence: AgentProposal[]
}

function buildQuestionPlan(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
): string[] {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()
  const personal = readPersonalSnapshot(contextPack)
  const plan: string[] = []

  const hasAttr = (d: keyof typeof attrs, key: string): boolean => {
    const bucket = attrs[d] as Record<string, { value?: unknown }> | undefined
    return Boolean(bucket?.[key]?.value != null)
  }

  if (isAgeQuestion(userMessage) && !personal.birthDate) {
    plan.push('Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).')
  }

  if (domain === 'nutrition' || lower.includes('dieta') || lower.includes('aliment')) {
    if (!hasAttr('nutrition', 'allergy') && !hasAttr('health', 'allergy')) {
      plan.push('Hai allergie o intolleranze alimentari da registrare?')
    }
    if (!hasAttr('nutrition', 'goal') && !hasAttr('general', 'goal')) {
      plan.push('Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?')
    }
    return plan
  }

  if (domain === 'training') {
    if (!hasAttr('training', 'training_frequency_per_week')) {
      plan.push('Quanti allenamenti a settimana riesci a fare realisticamente?')
    }
    if (!hasAttr('training', 'injury')) {
      plan.push('Hai infortuni o limitazioni fisiche attive da considerare nel piano?')
    }
    return plan
  }

  if (domain === 'health') {
    if (!hasAttr('health', 'symptom_duration')) {
      plan.push('Da quanto tempo è presente il sintomo principale?')
    }
    if (!hasAttr('health', 'diagnosis')) {
      plan.push('Hai già una diagnosi medica confermata o esami recenti disponibili?')
    }
    return plan
  }

  if (domain === 'mindfulness') {
    if (!hasAttr('mindfulness', 'stress_level')) {
      plan.push('Su una scala 0-10, quanto è il tuo livello di stress medio?')
    }
    if (!hasAttr('mindfulness', 'sleep_hours')) {
      plan.push('Quante ore dormi mediamente per notte?')
    }
    return plan
  }

  return plan
}

function getPendingQuestionsFromWorkspace(
  contextPack: ContextPack,
  domain: Domain,
  activeSpecialist?: ActiveSpecialist,
): string[] {
  const workspaces = contextPack.history.agentWorkspaces ?? []
  const selected = workspaces
    .filter((w) => {
      if (activeSpecialist && w.agentId === activeSpecialist.id) return true
      if (w.pendingDomain && w.pendingDomain === domain) return true
      return false
    })
    .flatMap((w) => w.pendingQuestions ?? [])
    .map((q) => q.trim())
    .filter((q) => q.length > 0)

  const seen = new Set<string>()
  return selected.filter((q) => {
    const key = q.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildInterviewQueue(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
  activeSpecialist?: ActiveSpecialist,
): { askNow: string[]; pendingNext: string[] } {
  // Allow more questions upfront only in locked-specialist mode when profile is empty + no queued questions.
  // In team-led mode (no activeSpecialist) stay conservative at 1 to avoid flooding the user.
  const attrs = contextPack.user.attributes ?? {}
  const domainAttrs =
    ((attrs as Record<string, unknown>)[domain] as Record<string, unknown> | undefined) ?? {}
  const fromWorkspace = getPendingQuestionsFromWorkspace(contextPack, domain, activeSpecialist)
  const isFirstInteractionInDomain =
    Object.keys(domainAttrs).length === 0 && fromWorkspace.length === 0 && activeSpecialist != null
  const maxAskNow = isFirstInteractionInDomain ? 3 : 1

  // 2A — PRIORITY QUEUE: L1 → workspace pending → L2 → L3 domain-specific
  // L1 baseline (only if first conversation and profile empty)
  const isFirstConversation = contextPack.history.recentMessages.length === 0
  const l1Questions = isFirstConversation ? buildL1BaselineQuestions(contextPack, userMessage) : []

  // Workspace pending questions (from previous turns)
  const workspaceQueue = fromWorkspace
    .map((question) => question.trim())
    .filter((question) => question.length > 0 && !isGenericQuestion(question))
  const seenWorkspace = new Set<string>()
  const orderedWorkspace = workspaceQueue.filter((question) => {
    const key = question.toLowerCase()
    if (seenWorkspace.has(key)) return false
    seenWorkspace.add(key)
    return true
  })

  // L2 triage (only if L1 not triggered and no workspace questions pending)
  const l2Questions =
    l1Questions.length === 0 && orderedWorkspace.length === 0
      ? buildL2TriageQuestions(contextPack, userMessage)
      : []

  // L3 domain-specific
  const fromPlan = buildQuestionPlan(domain, contextPack, userMessage)
  const seenAll = new Set<string>([
    ...l1Questions.map((q) => q.toLowerCase()),
    ...orderedWorkspace.map((q) => q.toLowerCase()),
    ...l2Questions.map((q) => q.toLowerCase()),
  ])

  const policy = applyQuestionPolicy(
    fromPlan
      .filter((question) => !seenAll.has(question.trim().toLowerCase()))
      .map((question) => ({ question, priority: 10 })),
    {
      domain,
      maxQuestions: Math.max(
        0,
        maxAskNow - l1Questions.length - orderedWorkspace.length - l2Questions.length,
      ),
      dedupeStrategy: 'exact',
    },
  )

  // Merge in priority order: L1 → workspace → L2 → L3
  const orderedQuestions = [
    ...l1Questions,
    ...orderedWorkspace,
    ...l2Questions,
    ...policy.orderedQuestions,
  ]

  if (orderedQuestions.length === 0) return { askNow: [], pendingNext: [] }

  return {
    askNow: orderedQuestions.slice(0, maxAskNow),
    pendingNext: orderedQuestions.slice(maxAskNow),
  }
}

function buildCriticalQuestions(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
  _activeSpecialist?: ActiveSpecialist,
): string[] {
  const question = buildQuestionPlan(domain, contextPack, userMessage)[0] ?? null
  if (!question || isGenericQuestion(question)) return []
  return [question]
}

function mergeInterviewQuestions(existing: string[], critical: string[]): string[] {
  return applyQuestionPolicy(
    [
      ...existing.map((question) => ({ question, priority: 20 })),
      ...critical.map((question) => ({ question, priority: 10 })),
    ],
    { domain: 'general', maxQuestions: 3, dedupeStrategy: 'exact' },
  ).orderedQuestions
}

export function applyInterviewFlow(input: InterviewFlowInput): InterviewFlowResult {
  const {
    domain,
    contextPack,
    userMessage,
    consensusGatingQuestions,
    round2Proposals,
    activeSpecialist,
  } = input

  const queue = buildInterviewQueue(domain, contextPack, userMessage, activeSpecialist)
  const interviewCriticalQuestions = buildCriticalQuestions(
    domain,
    contextPack,
    userMessage,
    activeSpecialist,
  )
  const mergedInterviewQuestions = mergeInterviewQuestions(
    consensusGatingQuestions,
    queue.askNow.length > 0 ? queue.askNow : interviewCriticalQuestions,
  )
  const finalInterviewQuestions = mergedInterviewQuestions.slice(0, 3)

  const round2WithQueue = round2Proposals.map((proposal, index) => {
    const shouldOwnQueue =
      activeSpecialist?.id === proposal.agentId || (!activeSpecialist && index === 0)
    if (!shouldOwnQueue) return proposal
    return {
      ...proposal,
      pendingDomain: domain,
      pendingQuestions: queue.pendingNext,
    }
  })

  const hasQueueOwner = round2WithQueue.some((proposal) => Array.isArray(proposal.pendingQuestions))
  const round2ForPersistence =
    !hasQueueOwner && queue.pendingNext.length > 0
      ? [
          ...round2WithQueue,
          {
            agentId: activeSpecialist?.id ?? 'orchestratore',
            domain,
            summary: 'Interview queue state',
            reasoning: 'Persisted pending interview follow-up questions.',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 1,
            pendingDomain: domain,
            pendingQuestions: queue.pendingNext,
          } satisfies AgentProposal,
        ]
      : round2WithQueue

  return {
    finalInterviewQuestions,
    round2WithQueue,
    round2ForPersistence,
  }
}
