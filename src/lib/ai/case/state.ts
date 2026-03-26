export type CaseProtocolState = 'owner_active' | 'consult_active_takeover' | 'handoff_pending_user'
export type CaseDomainPanelStatus = 'active' | 'monitoring' | 'paused' | 'needs_input'
export type CaseSpeakerPolicy = 'team' | 'lead' | 'explicit_agent' | 'switch'

export type CaseTransitionKind =
  | 'initialized'
  | 'consult_requested'
  | 'takeover_started'
  | 'takeover_continued'
  | 'return_baton'
  | 'consult_blocked'
  | 'handoff_requested'
  | 'handoff_completed'
  | 'domain_shift'

export type CaseProtocolEvent = {
  kind: CaseTransitionKind
  actorAgentId?: string
  fromAgentId?: string
  toAgentId?: string
  reason?: string
}

export type CaseDomainPanel = {
  domain: string
  selectedAgentId: string | null
  candidateAgentIds: string[]
  status: CaseDomainPanelStatus
  priorityScore: number
  lastReasoningAt: string | null
  pendingNeeds: string[]
}

export type CaseConversationFocus = {
  activeProblems: string[]
  activeGoals: string[]
  activeConstraints: string[]
  summary: string | null
}

export type CaseCoordinationState = {
  crossDomainConflicts: string[]
  dependencies: string[]
  needsReview: boolean
}

export type CaseState = {
  conversationId: string
  ownerAgentId: string
  activeSpeakerAgentId: string
  protocolState: CaseProtocolState
  consultTargetAgentId?: string
  returnTargetAgentId?: string
  consultReason?: string
  pendingHandoffAgentId?: string
  checkpointReason?: string
  takeoverTurns: number
  loopCount: number
  handoffCount: number
  schemaVersion?: number
  activeDomains?: string[]
  domainPanels?: CaseDomainPanel[]
  leadDomain?: string | null
  speakerPolicy?: CaseSpeakerPolicy
  conversationFocus?: CaseConversationFocus
  coordinationState?: CaseCoordinationState
  sharedOpenQuestions?: string[]
  domainOpenQuestions?: Record<string, string[]>
  updatedAt?: string
}

export function isCaseProtocolState(value: unknown): value is CaseProtocolState {
  return (
    value === 'owner_active' ||
    value === 'consult_active_takeover' ||
    value === 'handoff_pending_user'
  )
}

function isCaseDomainPanelStatus(value: unknown): value is CaseDomainPanelStatus {
  return (
    value === 'active' || value === 'monitoring' || value === 'paused' || value === 'needs_input'
  )
}

function isCaseSpeakerPolicy(value: unknown): value is CaseSpeakerPolicy {
  return value === 'team' || value === 'lead' || value === 'explicit_agent' || value === 'switch'
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

function normalizeOptionalStringArrayRecord(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const out: Record<string, string[]> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const list = normalizeStringArray(raw)
    if (list.length > 0) out[key] = list
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normalizeDomainPanels(value: unknown): CaseDomainPanel[] | undefined {
  if (!Array.isArray(value)) return undefined
  const panels: CaseDomainPanel[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const v = raw as Record<string, unknown>
    if (
      typeof v.domain !== 'string' ||
      !isCaseDomainPanelStatus(v.status) ||
      typeof v.priorityScore !== 'number'
    ) {
      continue
    }
    panels.push({
      domain: v.domain,
      selectedAgentId:
        typeof v.selectedAgentId === 'string'
          ? v.selectedAgentId
          : v.selectedAgentId === null
            ? null
            : null,
      candidateAgentIds: normalizeStringArray(v.candidateAgentIds),
      status: v.status,
      priorityScore: Number.isFinite(v.priorityScore) ? v.priorityScore : 0,
      lastReasoningAt:
        typeof v.lastReasoningAt === 'string'
          ? v.lastReasoningAt
          : v.lastReasoningAt === null
            ? null
            : null,
      pendingNeeds: normalizeStringArray(v.pendingNeeds),
    })
  }
  return panels.length > 0 ? panels : undefined
}

function normalizeConversationFocus(value: unknown): CaseConversationFocus | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  return {
    activeProblems: normalizeStringArray(v.activeProblems),
    activeGoals: normalizeStringArray(v.activeGoals),
    activeConstraints: normalizeStringArray(v.activeConstraints),
    summary: typeof v.summary === 'string' ? v.summary : v.summary === null ? null : null,
  }
}

function normalizeCoordinationState(value: unknown): CaseCoordinationState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  return {
    crossDomainConflicts: normalizeStringArray(v.crossDomainConflicts),
    dependencies: normalizeStringArray(v.dependencies),
    needsReview: v.needsReview === true,
  }
}

function buildFallbackCanonicalState(
  conversationId: string,
  ownerAgentId: string,
  activeSpeakerAgentId: string,
): Pick<
  CaseState,
  | 'schemaVersion'
  | 'activeDomains'
  | 'domainPanels'
  | 'leadDomain'
  | 'speakerPolicy'
  | 'conversationFocus'
  | 'coordinationState'
  | 'sharedOpenQuestions'
  | 'domainOpenQuestions'
> {
  return {
    schemaVersion: 1,
    activeDomains: [],
    domainPanels: [],
    leadDomain: null,
    speakerPolicy: activeSpeakerAgentId !== ownerAgentId ? 'explicit_agent' : 'lead',
    conversationFocus: {
      activeProblems: [],
      activeGoals: [],
      activeConstraints: [],
      summary: null,
    },
    coordinationState: {
      crossDomainConflicts: [],
      dependencies: [],
      needsReview: false,
    },
    sharedOpenQuestions: [],
    domainOpenQuestions: {},
  }
}

export function normalizeCaseState(value: unknown): CaseState | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>

  if (typeof v.conversationId !== 'string') {
    return null
  }

  const domainPanels = normalizeDomainPanels(v.domainPanels)
  const activeDomains = normalizeStringArray(v.activeDomains)
  const leadDomain =
    typeof v.leadDomain === 'string' ? v.leadDomain : v.leadDomain === null ? null : null
  const speakerPolicy = isCaseSpeakerPolicy(v.speakerPolicy) ? v.speakerPolicy : undefined
  const conversationFocus = normalizeConversationFocus(v.conversationFocus)
  const coordinationState = normalizeCoordinationState(v.coordinationState)
  const sharedOpenQuestions = normalizeStringArray(v.sharedOpenQuestions)
  const domainOpenQuestions = normalizeOptionalStringArrayRecord(v.domainOpenQuestions)

  const ownerAgentId =
    typeof v.ownerAgentId === 'string'
      ? v.ownerAgentId
      : typeof domainPanels?.[0]?.selectedAgentId === 'string'
        ? domainPanels[0].selectedAgentId
        : 'orchestratore'
  const activeSpeakerAgentId =
    typeof v.activeSpeakerAgentId === 'string'
      ? v.activeSpeakerAgentId
      : typeof domainPanels?.[0]?.selectedAgentId === 'string'
        ? domainPanels[0].selectedAgentId
        : ownerAgentId
  const protocolState = isCaseProtocolState(v.protocolState) ? v.protocolState : 'owner_active'
  const takeoverTurns =
    typeof v.takeoverTurns === 'number' ? Math.max(0, Math.trunc(v.takeoverTurns)) : 0
  const loopCount = typeof v.loopCount === 'number' ? Math.max(0, Math.trunc(v.loopCount)) : 0
  const fallbackCanonical = buildFallbackCanonicalState(
    v.conversationId,
    ownerAgentId,
    activeSpeakerAgentId,
  )

  return {
    conversationId: v.conversationId,
    ownerAgentId,
    activeSpeakerAgentId,
    protocolState,
    consultTargetAgentId:
      typeof v.consultTargetAgentId === 'string' ? v.consultTargetAgentId : undefined,
    returnTargetAgentId:
      typeof v.returnTargetAgentId === 'string' ? v.returnTargetAgentId : undefined,
    consultReason: typeof v.consultReason === 'string' ? v.consultReason : undefined,
    pendingHandoffAgentId:
      typeof v.pendingHandoffAgentId === 'string' ? v.pendingHandoffAgentId : undefined,
    checkpointReason: typeof v.checkpointReason === 'string' ? v.checkpointReason : undefined,
    takeoverTurns,
    loopCount,
    handoffCount: typeof v.handoffCount === 'number' ? Math.max(0, Math.trunc(v.handoffCount)) : 0,
    schemaVersion:
      typeof v.schemaVersion === 'number' && Number.isFinite(v.schemaVersion)
        ? Math.max(1, Math.trunc(v.schemaVersion))
        : fallbackCanonical.schemaVersion,
    activeDomains: activeDomains.length > 0 ? activeDomains : fallbackCanonical.activeDomains,
    domainPanels: domainPanels ?? fallbackCanonical.domainPanels,
    leadDomain,
    speakerPolicy: speakerPolicy ?? fallbackCanonical.speakerPolicy,
    conversationFocus: conversationFocus ?? fallbackCanonical.conversationFocus,
    coordinationState: coordinationState ?? fallbackCanonical.coordinationState,
    sharedOpenQuestions:
      sharedOpenQuestions.length > 0 ? sharedOpenQuestions : fallbackCanonical.sharedOpenQuestions,
    domainOpenQuestions: domainOpenQuestions ?? fallbackCanonical.domainOpenQuestions,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : undefined,
  }
}
