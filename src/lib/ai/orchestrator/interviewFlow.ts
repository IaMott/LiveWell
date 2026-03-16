import { applyQuestionPolicy, isGenericQuestion } from '../policy/questionPolicy'
import { ActiveSpecialist, AgentProposal, ContextPack, Domain } from '../types'
import { isAgeQuestion, readPersonalSnapshot } from './inputInference'
import { getMissingRequiredFields, getQuestionForField } from './intakeQuestions'

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

  // Check declared goal in general attributes
  const generalAttrs = attrs['general'] as Record<string, { value?: unknown }> | undefined
  const hasDeclaredGoal = Boolean(generalAttrs?.['declared_goal']?.value != null)

  // Step 1 — collect age first (prerequisite for all agents)
  if (!personal.birthDate) {
    return ['Quanti anni hai?']
  }

  // Step 2 — once age is known, collect the primary goal
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
  /** IDs of all specialists in the current team — used for peer routing */
  teamAgentIds?: string[]
}

export type InterviewFlowResult = {
  finalInterviewQuestions: string[]
  round2WithQueue: AgentProposal[]
  round2ForPersistence: AgentProposal[]
  /**
   * Peer specialists that should receive pending questions on their next turn.
   * These fields are owned by a peer (e.g. sleep_hours → coach-del-sonno) and
   * are already stored as pendingQuestions in their stub AgentProposal inside
   * round2ForPersistence.
   */
  peerRequests: Array<{ agentId: string; questions: string[] }>
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
  /** Pre-computed questions for the specialist's own missing required fields */
  specialistOwnFieldQuestions?: string[],
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

  // 2A — PRIORITY QUEUE: workspace pending → L1 → L2 → L3 domain-specific
  // Workspace pending questions are computed first because they take absolute priority
  // over L1 baseline: if questions were queued in a previous turn, ask those before
  // asking the age question again (the age may have already been collected).
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

  // L1 baseline (only if first conversation AND no pending workspace questions AND no active specialist)
  // In locked-specialist mode the specialist's own intake questions handle baseline collection;
  // asking the generic age question on top would consume one of the 3 upfront slots.
  const isFirstConversation = contextPack.history.recentMessages.length === 0
  const l1Questions =
    isFirstConversation && orderedWorkspace.length === 0 && !activeSpecialist
      ? buildL1BaselineQuestions(contextPack, userMessage)
      : []

  // L2 triage (only in team mode — not in locked-specialist mode)
  // Specialist mode uses its own intake questions; L2 would compete for slots.
  const l2Questions =
    l1Questions.length === 0 && orderedWorkspace.length === 0 && !activeSpecialist
      ? buildL2TriageQuestions(contextPack, userMessage)
      : []

  // L3 domain-specific: specialist completeness-gate questions first, then generic plan
  const ownFieldQs = specialistOwnFieldQuestions ?? []
  const fromPlan = buildQuestionPlan(domain, contextPack, userMessage)
  // Merge: missing required-field questions take precedence over generic plan questions
  const ownFieldSet = new Set(ownFieldQs.map((q) => q.trim().toLowerCase()))
  const combinedL3 = [
    ...ownFieldQs,
    ...fromPlan.filter((q) => !ownFieldSet.has(q.trim().toLowerCase())),
  ]

  const seenAll = new Set<string>([
    ...l1Questions.map((q) => q.toLowerCase()),
    ...orderedWorkspace.map((q) => q.toLowerCase()),
    ...l2Questions.map((q) => q.toLowerCase()),
  ])

  const policy = applyQuestionPolicy(
    combinedL3
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
    teamAgentIds,
  } = input

  // ---------------------------------------------------------------------------
  // Layer 1 — Completeness gate: compute missing required fields for the active
  // specialist, split into own-fields (ask directly) and peer-fields (route).
  // ---------------------------------------------------------------------------
  let specialistOwnFieldQuestions: string[] = []
  let peerRequests: Array<{ agentId: string; questions: string[] }> = []

  if (activeSpecialist) {
    const missing = getMissingRequiredFields(activeSpecialist.id, contextPack, teamAgentIds)
    specialistOwnFieldQuestions = missing.ownFields.map((f) =>
      getQuestionForField(activeSpecialist.id, f),
    )
    peerRequests = missing.peerFields.map(({ agentId, fields }) => ({
      agentId,
      questions: fields.map((f) => getQuestionForField(agentId, f)),
    }))
  }

  const queue = buildInterviewQueue(
    domain,
    contextPack,
    userMessage,
    activeSpecialist,
    specialistOwnFieldQuestions,
  )
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
  const baseRound2ForPersistence =
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

  // Append stub proposals for peer specialists so their pendingQuestions are
  // persisted and picked up when those specialists respond in a future turn.
  const existingAgentIds = new Set(baseRound2ForPersistence.map((p) => p.agentId))
  const peerStubProposals: AgentProposal[] = peerRequests
    .filter(({ agentId }) => !existingAgentIds.has(agentId) && agentId !== 'orchestratore')
    .map(({ agentId, questions }) => ({
      agentId,
      domain,
      summary: `Raccolta dati specialistica per ${agentId}`,
      reasoning: `Campi mancanti da raccogliere: ${questions.length}`,
      questions: [],
      recommendations: [],
      toolCalls: [],
      confidence: 1,
      pendingDomain: domain,
      pendingQuestions: questions,
    }))

  const round2ForPersistence = [...baseRound2ForPersistence, ...peerStubProposals]

  return {
    finalInterviewQuestions,
    round2WithQueue,
    round2ForPersistence,
    peerRequests,
  }
}
