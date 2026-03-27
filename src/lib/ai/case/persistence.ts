import type { CanonicalCaseStateSnapshot } from '../types'
import { z } from 'zod'
import { applyCanonicalSnapshotToLegacyCaseState, toCanonicalCaseStateSnapshot } from './compat'
import { normalizeCaseState, type CaseState } from './state'

export type CanonicalCaseRuntimeState = CanonicalCaseStateSnapshot

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

const domainSchema = z.enum([
  'general',
  'nutrition',
  'health',
  'training',
  'mindfulness',
  'inspiration',
  'coordination',
])

const domainPanelStatusSchema = z.enum(['active', 'monitoring', 'paused', 'needs_input'])
const speakerPolicySchema = z.enum(['team', 'lead', 'explicit_agent', 'switch'])

const canonicalSnapshotSchema = z.object({
  schemaVersion: z.number(),
  conversationId: z.string().min(1),
  activeDomains: z.array(domainSchema),
  domainPanels: z.array(
    z.object({
      domain: domainSchema,
      selectedAgentId: z.string().min(1).nullable(),
      candidateAgentIds: z.array(z.string()),
      status: domainPanelStatusSchema,
      priorityScore: z.number(),
      lastReasoningAt: z.string().nullable(),
      pendingNeeds: z.array(z.string()),
    }),
  ),
  leadDomain: domainSchema.nullable(),
  speakerPolicy: speakerPolicySchema,
  conversationFocus: z.object({
    activeProblems: z.array(z.string()),
    activeGoals: z.array(z.string()),
    activeConstraints: z.array(z.string()),
    summary: z.string().nullable(),
  }),
  coordinationState: z.object({
    crossDomainConflicts: z.array(z.string()),
    dependencies: z.array(z.string()),
    needsReview: z.boolean(),
  }),
  sharedOpenQuestions: z.array(z.string()),
  domainOpenQuestions: z.record(z.array(z.string())),
  updatedAt: z.string().min(1),
})

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

function inferStoredProtocolState(snapshot: CanonicalCaseRuntimeState): CaseState['protocolState'] {
  if (snapshot.speakerPolicy === 'explicit_agent' || snapshot.speakerPolicy === 'switch') {
    return 'consult_active_takeover'
  }
  return 'owner_active'
}

function buildStoredLegacyEnvelope(
  snapshot: CanonicalCaseRuntimeState,
  current?: CaseState | null,
): Record<string, unknown> {
  const leadPanel =
    snapshot.domainPanels.find((panel) => panel.domain === snapshot.leadDomain) ??
    snapshot.domainPanels[0]
  const activeSpeakerAgentId =
    leadPanel?.selectedAgentId ??
    current?.activeSpeakerAgentId ??
    current?.ownerAgentId ??
    'orchestratore'
  const ownerAgentId = current?.ownerAgentId ?? activeSpeakerAgentId

  return {
    conversationId: snapshot.conversationId,
    ownerAgentId,
    activeSpeakerAgentId,
    protocolState: current?.protocolState ?? inferStoredProtocolState(snapshot),
    consultTargetAgentId: current?.consultTargetAgentId ?? null,
    returnTargetAgentId: current?.returnTargetAgentId ?? null,
    consultReason: current?.consultReason ?? null,
    pendingHandoffAgentId: current?.pendingHandoffAgentId ?? null,
    checkpointReason: current?.checkpointReason ?? null,
    takeoverTurns: current?.takeoverTurns ?? 0,
    loopCount: current?.loopCount ?? 0,
    handoffCount: current?.handoffCount ?? 0,
  }
}

function parseStoredCanonicalSnapshot(rawSnapshot: unknown): CanonicalCaseRuntimeState | null {
  const parsed = canonicalSnapshotSchema.safeParse(rawSnapshot)
  return parsed.success ? parsed.data : null
}

function readLegacyCaseState(value: unknown): CaseState | null {
  return normalizeCaseState(value)
}

export function readCanonicalCaseRuntimeState(value: unknown): CanonicalCaseRuntimeState | null {
  if (!value || typeof value !== 'object') return null

  const record = value as StoredCaseStateRecord
  const hasStoredSnapshot = record.stateSnapshot != null
  if (hasStoredSnapshot) {
    return parseStoredCanonicalSnapshot(record.stateSnapshot)
  }

  const legacy = readLegacyCaseState(value)
  return toCanonicalCaseStateSnapshot(legacy)
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

export function toStoredCaseRuntimeState(
  caseState: CanonicalCaseRuntimeState,
  current?: CaseState | null,
): StoredCaseStateRecord {
  return {
    ...buildStoredLegacyEnvelope(caseState, current),
    stateSnapshot: serializeCanonicalSnapshot(caseState),
  }
}

/**
 * Phase 1 canonical envelope for stores that can persist a shadow snapshot
 * alongside the legacy case-state columns. Not yet wired into Prisma callers.
 */
export function toStoredCaseStateWithCanonicalSnapshot(
  caseState: CaseState,
): StoredCaseStateRecord {
  const snapshot = toCanonicalCaseStateSnapshot(caseState)
  if (!snapshot) return toStoredCaseState(caseState)
  return toStoredCaseRuntimeState(snapshot, caseState)
}

/**
 * Legacy-safe facade:
 * - future callers should prefer readCanonicalCaseRuntimeState()
 * - existing callers can keep receiving CaseState while the canonical boundary
 *   remains the primary source of truth
 */
export function fromStoredCaseState(value: unknown): CaseState | null {
  const record = value && typeof value === 'object' ? (value as StoredCaseStateRecord) : null
  const hasStoredSnapshot = record?.stateSnapshot != null
  const legacy = readLegacyCaseState(value)
  const canonical = readCanonicalCaseRuntimeState(value)
  if (!canonical) return hasStoredSnapshot ? null : legacy
  return applyCanonicalSnapshotToLegacyCaseState({ snapshot: canonical, current: legacy })
}
