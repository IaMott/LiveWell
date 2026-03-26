import type { CanonicalCaseStateSnapshot } from '../types'
import { applyCanonicalSnapshotToLegacyCaseState, toCanonicalCaseStateSnapshot } from './compat'
import { normalizeCaseState, type CaseState } from './state'

export type CaseStateStore = {
  findCaseStateByConversationId: (conversationId: string) => Promise<Record<string, unknown> | null>
  upsertCaseState: (input: {
    userId: string
    conversationId: string
    caseState: CaseState
  }) => Promise<void>
}

export type StoredCaseStateRecord = Record<string, unknown> & {
  stateSnapshot?: Record<string, unknown> | null
}

function serializeCanonicalSnapshot(snapshot: CanonicalCaseStateSnapshot): Record<string, unknown> {
  return {
    schemaVersion: snapshot.schemaVersion,
    conversationId: snapshot.conversationId,
    activeDomains: snapshot.activeDomains,
    domainPanels: snapshot.domainPanels,
    leadDomain: snapshot.leadDomain,
    speakerPolicy: snapshot.speakerPolicy,
    conversationFocus: snapshot.conversationFocus,
    coordinationState: snapshot.coordinationState,
    sharedOpenQuestions: snapshot.sharedOpenQuestions,
    domainOpenQuestions: snapshot.domainOpenQuestions,
    updatedAt: snapshot.updatedAt,
  }
}

function toCanonicalSnapshotFromStoredRecord(
  rawSnapshot: unknown,
  conversationIdFallback?: string,
): CanonicalCaseStateSnapshot | null {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') return null

  const normalizedSnapshot = normalizeCaseState({
    ownerAgentId: 'orchestratore',
    activeSpeakerAgentId: 'orchestratore',
    protocolState: 'owner_active',
    conversationId:
      typeof (rawSnapshot as { conversationId?: unknown }).conversationId === 'string'
        ? (rawSnapshot as { conversationId: string }).conversationId
        : conversationIdFallback,
    ...rawSnapshot,
  })
  if (!normalizedSnapshot) return null

  return toCanonicalCaseStateSnapshot(normalizedSnapshot)
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

/**
 * Phase 1 canonical envelope for stores that can persist a shadow snapshot
 * alongside the legacy case-state columns. Not yet wired into Prisma callers.
 */
export function toStoredCaseStateWithCanonicalSnapshot(
  caseState: CaseState,
): StoredCaseStateRecord {
  const legacy = toStoredCaseState(caseState)
  const snapshot = toCanonicalCaseStateSnapshot(caseState)
  return {
    ...legacy,
    ...(snapshot ? { stateSnapshot: serializeCanonicalSnapshot(snapshot) } : {}),
  }
}

/**
 * Dual-read helper:
 * - legacy-only row -> normalized CaseState
 * - legacy + shadow canonical snapshot -> canonical data merged back into CaseState
 */
export function fromStoredCaseState(value: unknown): CaseState | null {
  if (!value || typeof value !== 'object') return null

  const record = value as StoredCaseStateRecord
  const legacy = normalizeCaseState(value)
  const snapshot = toCanonicalSnapshotFromStoredRecord(record.stateSnapshot, legacy?.conversationId)

  if (snapshot) {
    return applyCanonicalSnapshotToLegacyCaseState({ snapshot, current: legacy })
  }

  return legacy
}
