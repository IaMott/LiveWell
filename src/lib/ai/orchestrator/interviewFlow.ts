import { applyQuestionPolicy, isGenericQuestion } from '../policy/questionPolicy'
import { ActiveSpecialist, AgentProposal, ContextPack, Domain } from '../types'
import { isAgeQuestion, readPersonalSnapshot } from './inputInference'
import { getMissingRequiredFields, getQuestionForField } from './intakeQuestions'

const CONTINUATION_PATTERN =
  /\b(continuiamo|continua|proseguiamo|prosegui|riprendiamo|riprendi|torniamo|torniamo al|ripartiamo|restiamo|parliamo ancora)\b/i

/**
 * Detect when the user is *demanding output* (a plan, a schedule, a recipe…)
 * rather than providing more data. When this fires, gating questions are
 * suppressed: the agent must produce a substantive response.
 * Examples: "creami un piano", "voglio la dieta", "fammi il programma", "mandami le ricette".
 */
const OUTPUT_REQUEST_PATTERN =
  /\b(creami|fammi|dammi|mandami|preparami|costruisci(mi)?|dai(mi)?|fai(mi)?)\b.*\b(piano|dieta|programma|ricett|calendario|menu|menù|scheda|lista|orario)\b|\b(voglio|ho bisogno di|mi serve|mi dai|mi fai|mi mandi|vorrei)\b.{0,30}\b(piano|dieta|programma|ricett|calendario|menu|menù|scheda|lista)\b/i

const SPECIFIC_CASE_PATTERN =
  /\b(gastrite|reflusso|gonfiore|digestiv|nausea|rutti|dolore|farmac|ibuprofene|tachicardia|pressione alta|sfoghi|rash|prurito|ginocchio|schiena|spalla|caviglia|insonnia|risvegli|dormo male|sonno|caff[eè]|burnout|ansia|stress|concentrarmi|debiti|mutuo|rate|bollette|soldi|separaz|figli|accordi|legali|problemi pratici|organizzarmi|gestire tutto)\b/i

function buildConversationFocusText(contextPack: ContextPack, userMessage: string): string {
  const recent = contextPack.history.recentMessages
    .slice(-8)
    .map((m) => m.content)
    .join(' ')
  const summaries = (contextPack.history.recentConversationSummaries ?? [])
    .slice(-3)
    .map((s) => s.summary)
    .join(' ')
  const files = (contextPack.files ?? [])
    .map((file) => `${file.filename} ${file.extractedText ?? ''}`.slice(0, 300))
    .join(' ')
  return `${userMessage} ${recent} ${summaries} ${files}`.toLowerCase()
}

function hasSpecificCaseSignals(text: string): boolean {
  return (
    /\b\d{2,3}\s*(?:kg|cm|bpm|mmhg|m\/s)\b/i.test(text) ||
    SPECIFIC_CASE_PATTERN.test(text) ||
    /\b(non voglio parlare di|non la carriera|non la relazione|non l'alimentazione)\b/i.test(text)
  )
}

function hasResumeOrContinuationSignal(userMessage: string, contextPack: ContextPack): boolean {
  return (
    CONTINUATION_PATTERN.test(userMessage) ||
    ((contextPack.history.recentConversationSummaries?.length ?? 0) > 0 &&
      /\b(riprendiamo|torniamo|ripartiamo|da dove eravamo rimasti|sai gi[aà])\b/i.test(userMessage))
  )
}

function shouldPrioritizeActiveProblem(params: {
  domain: Domain
  contextPack: ContextPack
  userMessage: string
  activeSpecialist?: ActiveSpecialist
}): boolean {
  const conversationText = buildConversationFocusText(params.contextPack, params.userMessage)
  const hasMemory =
    (params.contextPack.history.recentConversationSummaries?.length ?? 0) > 0 ||
    (params.contextPack.history.crossConversationMessages?.length ?? 0) > 0

  if (params.activeSpecialist && hasSpecificCaseSignals(conversationText)) return true
  if (hasResumeOrContinuationSignal(params.userMessage, params.contextPack) && hasMemory)
    return true
  if (params.domain !== 'general' && hasSpecificCaseSignals(params.userMessage.toLowerCase()))
    return true
  return false
}

function isFocusedFollowUpQuestion(question: string): boolean {
  return /\b(dolore|problema fisico|sintomo|diagnosi|esami|farmaci|ore dormi|stress|sintomi digestivi|frequenza|alimenti|food|questione|urgenza|spese|debiti|vincoli|trigger|zona del corpo|relazione)\b/i.test(
    question,
  )
}

function buildFocusedQuestion(
  domain: Domain,
  conversationText: string,
  userMessage: string,
): string | null {
  const lower = `${conversationText} ${userMessage}`.toLowerCase()

  if (
    /\b(reflusso|gastrite|gonfiore|nausea|rutti|digestiv)\b/i.test(lower) &&
    (domain === 'nutrition' || domain === 'health')
  ) {
    // Skip if the user has already described their dietary triggers in the conversation.
    // Patterns: names of acidic/spicy/gaseous foods, or explicit "no trigger" answers.
    const alreadyDescribedTriggers =
      /\b(piccant|acid[io]|gasate|gassate|fritto|fritti|cioccolato|caff[eè]|agrumi|pomodoro|alcolici|spezie|latticin|bevande?|grassi|nessuna|non ho|non ci sono|non mangio|non bevo|non prendo)\b/i.test(
        lower,
      )
    if (alreadyDescribedTriggers) return null
    return 'Hai notato alimenti, bevande o orari dei pasti che peggiorano i sintomi digestivi?'
  }

  if (
    /\b(ginocchio|schiena|spalla|caviglia|dolore|male)\b/i.test(lower) &&
    /\b(corro|corsa|alleno|allenamento|sport)\b/i.test(lower)
  ) {
    return 'Il dolore compare durante il gesto sportivo, subito dopo, o resta anche a riposo?'
  }

  if (
    domain === 'mindfulness' &&
    /\b(sonno|insonnia|risvegli|mi sveglio|dormo male|caff[eè])\b/i.test(lower)
  ) {
    return 'Quante volte ti svegli durante la notte e in quali fasce orarie succede più spesso?'
  }

  if (domain === 'mindfulness' && /\b(burnout|stress|ansia|focus|concentrarmi)\b/i.test(lower)) {
    return 'Da quanto tempo senti questo calo di concentrazione e quanto impatta il lavoro quotidiano?'
  }

  if (domain === 'inspiration' && /\b(debiti|mutuo|rate|spese|bollette|soldi)\b/i.test(lower)) {
    return 'Qual è la pressione economica più urgente adesso tra rate, spese essenziali e debiti già aperti?'
  }

  if (
    (domain === 'inspiration' || domain === 'coordination') &&
    /\b(separaz|figli|soldi|problemi pratici|questioni pratiche)\b/i.test(lower)
  ) {
    return 'Quali sono le due questioni più urgenti da gestire adesso tra figli, soldi e organizzazione pratica?'
  }

  if (
    domain === 'coordination' &&
    /\b(organizzarmi|gestire tutto|priorit|fare ordine)\b/i.test(lower)
  ) {
    return 'Qual è il fronte che oggi ti sta facendo perdere più controllo: tempo, soldi, famiglia o lavoro?'
  }

  if (domain === 'health' && /\b(sfoghi|rash|prurito|pelle|cutane)\b/i.test(lower)) {
    return 'Da quanto tempo è presente il problema cutaneo e in quali zone si concentra di più?'
  }

  return null
}

// ---------------------------------------------------------------------------
// 2A — L1 Baseline questions (who is the user)
// ---------------------------------------------------------------------------

function buildL1BaselineQuestions(contextPack: ContextPack, userMessage: string): string[] {
  const personal = readPersonalSnapshot(contextPack)
  const attrs = contextPack.user.attributes ?? {}
  const lower = buildConversationFocusText(contextPack, userMessage)

  // Skip L1 if the message already carries specific health/numeric data (measurements, symptoms).
  const hasSpecificData =
    hasSpecificCaseSignals(lower) ||
    lower.includes('soffro') ||
    lower.includes('alleno') ||
    lower.includes('sono nato') ||
    lower.includes('sono nata') ||
    lower.includes('data di nascita')
  if (hasSpecificData) return []

  // F4: Collect ALL missing baseline fields and ask up to 3 at once instead of 1 per turn.
  // This reduces the 6+ turn onboarding to 2-3 turns max.
  const missing: string[] = []

  // Step 1 — Nome (solo se non viene dall'account)
  if (!personal.name) {
    missing.push('Come ti chiami?')
  }

  // Step 2 — Sesso
  if (!personal.gender) {
    const nameRef = personal.name ?? ''
    missing.push(
      `${nameRef ? `${nameRef}, q` : 'Q'}ual è il tuo sesso biologico? (M / F / Preferisco non specificare)`,
    )
  }

  // Step 3 — Età
  if (!personal.birthDate) {
    missing.push(`Quanti anni hai?`)
  }

  // Step 4 — Altezza
  if (!personal.height) {
    missing.push('Qual è la tua altezza in cm?')
  }

  // Step 5 — Peso
  if (!personal.weight) {
    missing.push('Qual è il tuo peso attuale in kg?')
  }

  // Step 6 — obiettivo principale
  const generalAttrs = attrs['general'] as Record<string, { value?: unknown }> | undefined
  const hasDeclaredGoal = Boolean(
    generalAttrs?.['goal']?.value != null || generalAttrs?.['declared_goal']?.value != null,
  )
  if (!hasDeclaredGoal) {
    missing.push('Qual è la cosa più importante che vorresti migliorare o raggiungere?')
  }

  // F4: Return up to 3 questions at once (batched), skip name if it's the only one known.
  // If name is the ONLY missing item, ask it alone for a warm greeting.
  if (missing.length === 0) return []
  return missing.slice(0, 3)
}

// ---------------------------------------------------------------------------
// 2A — L2 Triage questions (what is the main problem)
// ---------------------------------------------------------------------------

function buildL2TriageQuestions(contextPack: ContextPack, userMessage: string): string[] {
  const attrs = contextPack.user.attributes ?? {}
  const lower = buildConversationFocusText(contextPack, userMessage)

  // S1 + M4: Skip L2 only when message contains specific health/metric data.
  // Was using bare /\d/ (any digit) which wrongly skipped on "ho 30 anni", "piano 4", etc.
  // Fixed to measurement-specific pattern matching L1's guard.
  // Removed 'ho la' which was too broad (matched "ho la pizza", "ho la macchina", etc.).
  const hasSpecificContext =
    hasSpecificCaseSignals(lower) ||
    lower.includes('problema') ||
    lower.includes('sento') ||
    lower.includes('mangio') ||
    lower.includes('alleno') ||
    lower.includes('soffro')
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
  prioritizeActiveProblem = false,
): string[] {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()
  const conversationText = buildConversationFocusText(contextPack, userMessage)
  const personal = readPersonalSnapshot(contextPack)
  const plan: string[] = []

  const hasAttr = (d: keyof typeof attrs, key: string): boolean => {
    const bucket = attrs[d] as Record<string, { value?: unknown }> | undefined
    return Boolean(bucket?.[key]?.value != null)
  }

  if (isAgeQuestion(userMessage) && !personal.birthDate) {
    plan.push('Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).')
  }

  if (prioritizeActiveProblem) {
    const focused = buildFocusedQuestion(domain, conversationText, userMessage)
    if (focused) return [focused]
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

/**
 * Returns true if the given question was already asked AND the user replied
 * within the most recent N assistant→user message pairs in the conversation.
 * This prevents the orchestrator from repeating a question the user has
 * already answered in the same session.
 */
function wasAlreadyAnsweredInHistory(
  question: string,
  contextPack: ContextPack,
  windowPairs = 6,
): boolean {
  const messages = contextPack.history.recentMessages
  if (messages.length < 2) return false

  const questionTokens = new Set(
    question
      .toLowerCase()
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 4),
  )

  // Walk the history in reverse looking for assistant messages that contain
  // enough tokens from the question (semantic overlap > 60%).
  let pairsChecked = 0
  for (let i = messages.length - 1; i >= 0 && pairsChecked < windowPairs; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    const assistantTokens = new Set(
      msg.content
        .toLowerCase()
        .replace(/[?.,!]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 4),
    )
    const intersection = [...questionTokens].filter((t) => assistantTokens.has(t)).length
    const union = new Set([...questionTokens, ...assistantTokens]).size
    const overlap = union > 0 ? intersection / questionTokens.size : 0

    if (overlap >= 0.55) {
      // Found the assistant asking something similar; check that the NEXT message
      // is from the user (meaning they replied).
      if (i + 1 < messages.length && messages[i + 1].role === 'user') return true
    }
    pairsChecked++
  }
  return false
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
  const attrs = contextPack.user.attributes ?? {}
  const domainAttrs =
    ((attrs as Record<string, unknown>)[domain] as Record<string, unknown> | undefined) ?? {}
  const fromWorkspace = getPendingQuestionsFromWorkspace(contextPack, domain, activeSpecialist)
  const isFirstInteractionInDomain =
    Object.keys(domainAttrs).length === 0 && fromWorkspace.length === 0 && activeSpecialist != null

  // Compute baseline completion BEFORE maxAskNow — needed for both the cap and the L1 guard.
  const personalForBaseline = readPersonalSnapshot(contextPack)
  const hasCompletedBaseline = !!(
    personalForBaseline.name &&
    personalForBaseline.gender &&
    personalForBaseline.birthDate &&
    personalForBaseline.height &&
    personalForBaseline.weight
  )
  const isEarlyConversation = contextPack.history.recentMessages.length < 8
  const isContinuationMessage = CONTINUATION_PATTERN.test(userMessage)
  // When the user explicitly demands output (plan, diet, schedule, recipe…) suppress gating.
  const isOutputRequest = OUTPUT_REQUEST_PATTERN.test(userMessage)
  const prioritizeActiveProblem = shouldPrioritizeActiveProblem({
    domain,
    contextPack,
    userMessage,
    activeSpecialist,
  })

  // B-A fix: allow batching 3 questions in team mode when L1 baseline is still incomplete.
  // Previously maxAskNow=1 in team mode always, making the F4 batching unreachable.
  // isFirstInteractionInDomain covers specialist mode; isL1BaselinePending covers team mode.
  const isL1BaselinePending = !activeSpecialist && !hasCompletedBaseline && isEarlyConversation
  const maxAskNow = isOutputRequest
    ? 0
    : fromWorkspace.length > 0 || isContinuationMessage || prioritizeActiveProblem
      ? 1
      : isFirstInteractionInDomain || isL1BaselinePending
        ? 3
        : 1

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

  // Persisted workspace queues must be drained deterministically before introducing
  // new domain-specific prompts, otherwise we re-inflate the queue every turn.
  if (orderedWorkspace.length > 0) {
    return {
      askNow: orderedWorkspace.slice(0, 1),
      pendingNext: orderedWorkspace.slice(1),
    }
  }

  // L1 baseline — fires when core personal data is still missing.
  // Unlike a simple "first conversation" gate, we check actual data completeness so that:
  // - L1 continues across early messages of the SAME conversation (collecting data step by step)
  // - L1 stops once all baseline data is collected (across any conversation)
  // - L1 stops mid-conversation after too many exchanges (>= 8 messages) to avoid being intrusive
  const l1Questions =
    !hasCompletedBaseline && isEarlyConversation && !activeSpecialist && !prioritizeActiveProblem
      ? buildL1BaselineQuestions(contextPack, userMessage)
      : []

  // L2 triage (only in team mode — not in locked-specialist mode)
  // Specialist mode uses its own intake questions; L2 would compete for slots.
  const l2Questions =
    l1Questions.length === 0 && !activeSpecialist && !prioritizeActiveProblem
      ? buildL2TriageQuestions(contextPack, userMessage)
      : []

  // L3 domain-specific: specialist completeness-gate questions first, then generic plan
  // Filter out questions the user has already answered in this session.
  const ownFieldQsRaw = prioritizeActiveProblem
    ? (specialistOwnFieldQuestions ?? []).filter((question) => isFocusedFollowUpQuestion(question))
    : (specialistOwnFieldQuestions ?? [])
  const ownFieldQs = ownFieldQsRaw.filter((q) => !wasAlreadyAnsweredInHistory(q, contextPack))
  const fromPlanRaw = buildQuestionPlan(domain, contextPack, userMessage, prioritizeActiveProblem)
  const fromPlan = fromPlanRaw.filter((q) => !wasAlreadyAnsweredInHistory(q, contextPack))
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
