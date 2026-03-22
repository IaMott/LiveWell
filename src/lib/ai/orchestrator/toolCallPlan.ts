import { ActiveSpecialist, ContextPack, Domain, ToolCall } from '../types'
import { inferAttributeToolCallsFromMessage } from './inputInference'

const NON_RETRIABLE_TOOL_ERROR_CODES = new Set([
  'TOOL_FORBIDDEN_BY_AGENT_CAPABILITY',
  'FORBIDDEN',
  'OWNER_MODE_REQUIRED',
  'VALIDATION_ERROR',
])

export type ToolCallPlanInput = {
  consensusToolCalls: ToolCall[]
  message: string
  domainHint: Domain
  activeSpecialist?: ActiveSpecialist
  contextPack: ContextPack
  retryGuardWindowMs: number
}

export type ToolCallPlan = {
  toolCallsToExecute: ToolCall[]
  blockedToolCalls: ToolCall[]
  conflictMessages: string[]
}

function filterNonRetriableToolCallsFromRecentTrace(
  toolCalls: ToolCall[],
  contextPack: ContextPack,
  retryGuardWindowMs: number,
): { kept: ToolCall[]; blocked: ToolCall[] } {
  const trace = contextPack.history.toolExecutionTrace ?? []
  if (trace.length === 0 || toolCalls.length === 0) {
    return { kept: toolCalls, blocked: [] }
  }

  const now = Date.now()
  const recentBlockingToolNames = new Set(
    trace
      .filter((t) => {
        if (t.ok) return false
        if (!t.code || !NON_RETRIABLE_TOOL_ERROR_CODES.has(t.code)) return false
        const ageMs = now - new Date(t.createdAt).getTime()
        return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= retryGuardWindowMs
      })
      .map((t) => t.name),
  )

  if (recentBlockingToolNames.size === 0) {
    return { kept: toolCalls, blocked: [] }
  }

  const blocked = toolCalls.filter((c) => recentBlockingToolNames.has(c.name))
  const kept = toolCalls.filter((c) => !recentBlockingToolNames.has(c.name))
  return { kept, blocked }
}

export function planToolCalls(input: ToolCallPlanInput): ToolCallPlan {
  const fallbackToolCalls = inferAttributeToolCallsFromMessage(input.message, {
    domainHint: input.domainHint,
    activeSpecialist: input.activeSpecialist,
  })
  const mergedToolCalls = [...input.consensusToolCalls, ...fallbackToolCalls]
  // Semantic dedup: for user.setAttribute, match on domain+key+value (ignore notes, recordedAt)
  const semanticKey = (c: ToolCall): string => {
    if (c.name === 'user.setAttribute' && c.args) {
      const a = c.args as Record<string, unknown>
      return `${c.name}:${a.domain}:${a.key}:${JSON.stringify(a.value)}`
    }
    return `${c.name}:${JSON.stringify(c.args)}`
  }
  const dedupedToolCalls = mergedToolCalls.filter((c, idx, arr) => {
    const k = semanticKey(c)
    return arr.findIndex((x) => semanticKey(x) === k) === idx
  })
  const filteredByTrace = filterNonRetriableToolCallsFromRecentTrace(
    dedupedToolCalls,
    input.contextPack,
    input.retryGuardWindowMs,
  )

  return {
    toolCallsToExecute: filteredByTrace.kept,
    blockedToolCalls: filteredByTrace.blocked,
    conflictMessages:
      filteredByTrace.blocked.length > 0
        ? [`Blocked ${filteredByTrace.blocked.length} non-retriable tool call(s) from recent trace`]
        : [],
  }
}
