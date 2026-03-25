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

export type AgentInput = {
  requestId: string
  userId: string
  conversationId: string
  message: string
  domainHint?: Domain
  /** Canonical protocol state for the conversation. */
  caseState?: CaseState | null
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
    attributeHistory?: Record<string, Record<string, Array<{ value: unknown; recordedAt: string }>>>
    /** Completeness analysis across domains — populated by contextPackBuilder */
    medicalRecord?: MedicalRecord
  }
  history: {
    recentMessages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>
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

export type ConsensusResult = {
  domain: Domain
  finalMessageMarkdown: string
  toolCallsToExecute: ToolCall[]
  /** Active specialist for this turn (set by orchestrator) */
  activeSpecialist?: ActiveSpecialist
  /** Canonical case state after protocol evaluation for the current turn. */
  caseState?: CaseState
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
  }
}
