import type { CaseProtocolEvent, CaseState } from './case/state'
import type { RuntimeCapabilityContract } from './capabilities/contracts'

export type Domain =
  | 'general'
  | 'nutrition'
  | 'health'
  | 'training'
  | 'mindfulness'
  | 'inspiration'
  | 'coordination'

export type Role = 'OWNER' | 'ADMIN' | 'USER'

/** Business lifecycle status of a conversation/case from the user's perspective */
export type CaseStatus = 'open' | 'active' | 'pending' | 'completed' | 'archived'

/** Priority level of a conversation/case for backlog management */
export type CasePriority = 'urgent' | 'high' | 'normal' | 'low' | 'backlog'

export type ToolCall = {
  id: string
  name: string
  args: unknown
}

export type ToolResult = {
  toolCallId: string
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
  confirmToken?: string
  requiresUserConfirmation?: boolean
  uiEvent?: { title: string; description?: string; domain?: Domain }
}

export type AgentId = string

export type AgentProfile = {
  id: AgentId
  displayName: string
  domainTags: Domain[]
  primaryDomain?: Domain
  systemPrompt: string
  toolsAllowed: string[]
  competenceKeywords?: string[]
  escalationRules?: string[]
  disclaimerStyle?: 'concise' | 'standard' | 'strict'
  decisionStyle: 'team-led'
  runtimeCapabilities?: RuntimeCapabilityContract
}

/** Identifies the specialist currently active in a conversation turn */
export type ActiveSpecialist = {
  id: AgentId
  displayName: string
  domain: Domain
  /**
   * Full specialist competence tags (e.g. fisioterapista: ['training','health']).
   * Used by backend to keep specialist mode scoped to valid domains.
   */
  domains?: Domain[]
  runtimeCapabilities?: RuntimeCapabilityContract
}

export type DomainPanelStatus = 'active' | 'monitoring' | 'paused' | 'needs_input'

/**
 * Canonical per-domain panel shared by text chat and Gemini Live.
 * Phase 1 introduces the contract only; runtime adoption is incremental.
 */
export type DomainPanel = {
  domain: Domain
  selectedAgentId: AgentId | null
  candidateAgentIds: AgentId[]
  status: DomainPanelStatus
  priorityScore: number
  lastReasoningAt: string | null
  pendingNeeds: string[]
}

export type ConversationFocus = {
  activeProblems: string[]
  activeGoals: string[]
  activeConstraints: string[]
  summary: string | null
}

export type CoordinationState = {
  crossDomainConflicts: string[]
  dependencies: string[]
  needsReview: boolean
}

export type SpeakerPolicy = 'team' | 'lead' | 'explicit_agent' | 'switch'

/**
 * Shared canonical case snapshot consumed by both text and live adapters.
 * Legacy protocol fields remain in CaseState during the compatibility window.
 */
export type CanonicalCaseStateSnapshot = {
  schemaVersion: number
  conversationId: string
  activeDomains: Domain[]
  domainPanels: DomainPanel[]
  leadDomain: Domain | null
  speakerPolicy: SpeakerPolicy
  conversationFocus: ConversationFocus
  coordinationState: CoordinationState
  sharedOpenQuestions: string[]
  domainOpenQuestions: Partial<Record<Domain, string[]>>
  updatedAt: string
  /** Reason for the active consultation (preserved across snapshot conversions). */
  consultReason?: string
  /** Agent ID to return to after the current consultation ends. */
  returnTargetAgentId?: string
  /** Agent ID that initiated or is the target of the consultation. */
  consultTargetAgentId?: string
}

export type AgentInput = {
  requestId: string
  userId: string
  conversationId: string
  message: string
  domainHint?: Domain
  /** Legacy compatibility adapter for the protocol engine during the migration window. */
  caseState?: CaseState | null
  /** Canonical runtime snapshot — primary source of truth for orchestration input. */
  caseStateSnapshot?: CanonicalCaseStateSnapshot | null
  /** ID of the message this turn is replying to. Injected into context when present. */
  replyToMessageId?: string | null
  contextPack: ContextPack
  constraints?: {
    locale?: string
    timezone?: string
    userPreferences?: Record<string, unknown>
    practicalConstraints?: Record<string, unknown>
  }
}

export type AgentProposal = {
  agentId: AgentId
  domain: Domain
  summary: string // short
  reasoning: string // user-visible, no secrets
  questions?: string[] // gating questions
  recommendations?: Array<{
    title: string
    steps: string[]
    rationale: string
    safetyNotes?: string[]
    artifactsToSave?: Array<{
      type: 'nutrition' | 'training' | 'mindfulness' | 'other'
      title: string
      contentMarkdown: string
      relatedResourceIds?: Record<string, string>
    }>
  }>
  toolCalls?: ToolCall[] // proposed, not executed by agents
  confidence?: number // 0..1
  citations?: Array<{ title: string; url?: string; note?: string }> // optional
  /** Pyramidal consultation: agents can suggest additional specialists after Round 1 */
  suggestedConsultants?: string[] // agent IDs to add in Round 2
  flags?: {
    needsMoreInfo?: boolean
    potentialRisk?: boolean
    urgentEscalation?: boolean
  }
  /**
   * Backend interview queue metadata persisted in AgentWorkspace.
   * Lets the system ask one question per turn without forgetting follow-ups.
   */
  pendingQuestions?: string[]
  pendingDomain?: Domain
}

export type ContextPack = {
  user: {
    id: string
    role: Role
    profile?: Record<string, unknown>
    attributes?: UserAttributes
    attributeHistory?: Record<
      string,
      Record<string, Array<{ value: unknown; recordedAt: string; notes?: string }>>
    >
    /** G2: True when the EAV query hit the take:200 limit — some older attributes may be absent.
     * Agents should note this and avoid making completeness claims about historical data. */
    hasMoreAttributes?: boolean
    /** Completeness analysis across domains — populated by contextPackBuilder */
    medicalRecord?: MedicalRecord
  }
  history: {
    recentMessages: Array<{
      id?: string
      role: 'user' | 'assistant'
      content: string
      createdAt: string
    }>
    crossConversationMessages?: Array<{
      role: 'user' | 'assistant'
      content: string
      createdAt: string
    }>
    agentWorkspaces?: Array<{
      agentId: string
      round1Summary?: string
      round2Summary?: string
      pendingQuestions?: string[]
      pendingDomain?: Domain
      updatedAt: string
    }>
    toolExecutionTrace?: Array<{
      toolCallId: string
      name: string
      ok: boolean
      code?: string
      message?: string
      createdAt: string
    }>
    recentArtifacts: Array<{
      type: string
      title: string
      createdAt: string
      contentMarkdown?: string
      notes?: string
    }>
    /** Cross-conversation summaries for long-term memory (populated from ConversationSummary table) */
    recentConversationSummaries?: Array<{
      conversationId: string
      summary: string
      domain: string
      updatedAt: string
    }>
  }
  trackers: {
    health?: Record<string, unknown>
    nutrition?: Record<string, unknown>
    training?: Record<string, unknown>
    mindfulness?: Record<string, unknown>
  }
  notifications: {
    unreadCount: number
    lastSentAt?: string
  }
  files?: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
    extractedText?: string
    url?: string
    conversationId?: string
    recordedAt?: string
    notes?: string
  }>
  ui: {
    moodScore: number // 0..100
    sectionScores?: Partial<Record<Domain, number>>
  }
  // Geo: present ONLY if geoPreference.enabled === true (privacy-first)
  geo?: {
    country: string | null
    region: string | null
    city: string | null
    timezone: string | null
    accuracy: string | null
  }
  /** Non-clinical routing metadata — NEVER exposed to agents in clinical context */
  routing?: {
    agentFeedbackScores?: Record<string, number>
  }
}

export type AttributeValue = {
  value: unknown
  unit?: string
  recordedAt: string
  notes?: string
  source?: string
}

export type UserAttributes = {
  health?: Record<string, AttributeValue>
  nutrition?: Record<string, AttributeValue>
  training?: Record<string, AttributeValue>
  mindfulness?: Record<string, AttributeValue>
  personal?: Record<string, AttributeValue>
  general?: Record<string, AttributeValue>
}

export type DomainCompleteness = {
  filled: number
  total: number
  pct: number
}

/** Aggregated completeness and missing-key analysis across all tracked domains. */
export type MedicalRecord = {
  completeness: Record<string, DomainCompleteness>
  /** Domain → list of essential keys not yet recorded */
  missingKeys: Record<string, string[]>
}

export type DecisionTraceEvent = {
  step: number
  kind: 'domain_detected' | 'specialist_mode_resolved' | 'agents_selected'
  summary: string
  data: Record<string, string | number | boolean | null | string[]>
}

/** Quick-reply suggestion shown as a tappable button below an assistant message. */
export type QuickReply = {
  id: string
  /** Visible label on the button (e.g. "Fisioterapista") */
  label: string
  /** Message text sent when tapped (e.g. "Vorrei parlare con Fisioterapista") */
  text: string
  emoji?: string
  domain?: Domain
}

/** Individual agent response for multi-agent mode */
export type AgentResponse = {
  agentId: AgentId
  agentName: string
  domain: Domain
  content: string
}

export type ConsensusResult = {
  domain: Domain
  finalMessageMarkdown: string
  /** When ≥2 specialists respond, their individual responses are here */
  agentResponses?: AgentResponse[]
  toolCallsToExecute: ToolCall[]
  /** Active specialist for this turn (set by orchestrator) */
  activeSpecialist?: ActiveSpecialist
  /** Legacy compatibility adapter emitted for protocol continuity during migration. */
  caseState?: CaseState
  /** Canonical case runtime snapshot for text/live transport and persistence. */
  stateSnapshot?: CanonicalCaseStateSnapshot
  /** Protocol events emitted by the canonical case engine. */
  protocolEvents?: CaseProtocolEvent[]
  /** Quick-reply suggestions to display below the message (multi-domain triage, etc.) */
  quickReplies?: QuickReply[]
  ui: {
    domainIcon: Domain
    moodScore: number
    sectionScores?: Partial<Record<Domain, number>>
  }
  gatingQuestions?: string[]
  safety: {
    disclaimers?: string[]
    escalation?: 'none' | 'recommend-professional' | 'urgent'
  }
  artifactsToSave?: Array<{
    type: 'nutrition' | 'training' | 'mindfulness' | 'other'
    title: string
    contentMarkdown: string
  }>
  debug?: {
    selectedAgents: AgentId[]
    conflicts: string[]
    decisionTrace?: DecisionTraceEvent[]
    proposals?: AgentProposal[]
    round1Proposals?: AgentProposal[]
    round2Proposals?: AgentProposal[]
    blockedToolCalls?: ToolCall[]
    /** Tutte le proposte per ogni fase: [fase1[], fase2[], fase3[]] — per trace completo nel frontend e in DB */
    allPhaseProposals?: AgentProposal[][]
    /** IDs agenti aggiunti dinamicamente durante il peer review */
    expandedAgentIds?: string[]
    /** IDs agenti ritirati dopo peer review (analisi precedenti mantenute) */
    retiredAgentIds?: string[]
  }
}
