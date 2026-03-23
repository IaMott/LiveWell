export type CaseProtocolState = 'owner_active' | 'consult_active_takeover' | 'handoff_pending_user'

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
  updatedAt?: string
}

export function isCaseProtocolState(value: unknown): value is CaseProtocolState {
  return (
    value === 'owner_active' ||
    value === 'consult_active_takeover' ||
    value === 'handoff_pending_user'
  )
}

export function normalizeCaseState(value: unknown): CaseState | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (
    typeof v.conversationId !== 'string' ||
    typeof v.ownerAgentId !== 'string' ||
    typeof v.activeSpeakerAgentId !== 'string' ||
    !isCaseProtocolState(v.protocolState) ||
    typeof v.takeoverTurns !== 'number' ||
    typeof v.loopCount !== 'number'
  ) {
    return null
  }

  return {
    conversationId: v.conversationId,
    ownerAgentId: v.ownerAgentId,
    activeSpeakerAgentId: v.activeSpeakerAgentId,
    protocolState: v.protocolState,
    consultTargetAgentId:
      typeof v.consultTargetAgentId === 'string' ? v.consultTargetAgentId : undefined,
    returnTargetAgentId:
      typeof v.returnTargetAgentId === 'string' ? v.returnTargetAgentId : undefined,
    consultReason: typeof v.consultReason === 'string' ? v.consultReason : undefined,
    pendingHandoffAgentId:
      typeof v.pendingHandoffAgentId === 'string' ? v.pendingHandoffAgentId : undefined,
    checkpointReason: typeof v.checkpointReason === 'string' ? v.checkpointReason : undefined,
    takeoverTurns: Math.max(0, Math.trunc(v.takeoverTurns)),
    loopCount: Math.max(0, Math.trunc(v.loopCount)),
    handoffCount: typeof v.handoffCount === 'number' ? Math.max(0, Math.trunc(v.handoffCount)) : 0,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : undefined,
  }
}
