import type { CaseState } from './state'

export type CaseStateStore = {
  findCaseStateByConversationId: (conversationId: string) => Promise<Record<string, unknown> | null>
  upsertCaseState: (input: {
    userId: string
    conversationId: string
    caseState: CaseState
  }) => Promise<void>
}

export function toStoredCaseState(caseState: CaseState): Record<string, unknown> {
  return {
    conversationId: caseState.conversationId,
    ownerAgentId: caseState.ownerAgentId,
    activeSpeakerAgentId: caseState.activeSpeakerAgentId,
    protocolState: caseState.protocolState,
    consultTargetAgentId: caseState.consultTargetAgentId ?? null,
    returnTargetAgentId: caseState.returnTargetAgentId ?? null,
    consultReason: caseState.consultReason ?? null,
    pendingHandoffAgentId: caseState.pendingHandoffAgentId ?? null,
    checkpointReason: caseState.checkpointReason ?? null,
    takeoverTurns: caseState.takeoverTurns,
    loopCount: caseState.loopCount,
    handoffCount: caseState.handoffCount,
  }
}
