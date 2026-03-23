import type { Domain } from '@/lib/ai/types'

export type PersistedThinkingStep = {
  specialistName: string
  title: string
  thought?: string
  domain?: Domain
}

type ThinkingPayloadV1 = {
  version: 1
  steps: PersistedThinkingStep[]
}

const THINKING_MARKER_PREFIX = '<!--LIVEWELL_THINKING_V1:'
const THINKING_MARKER_SUFFIX = '-->'
const THINKING_MARKER_REGEX = /(?:\n{2})?<!--LIVEWELL_THINKING_V1:([A-Za-z0-9+/=]+)-->\s*$/

function isDomain(value: unknown): value is Domain {
  return (
    value === 'general' ||
    value === 'nutrition' ||
    value === 'health' ||
    value === 'training' ||
    value === 'mindfulness' ||
    value === 'inspiration' ||
    value === 'coordination'
  )
}

export function normalizeThinkingSteps(steps: unknown): PersistedThinkingStep[] {
  if (!Array.isArray(steps)) return []

  return steps.reduce<PersistedThinkingStep[]>((acc, step) => {
    if (!step || typeof step !== 'object') return acc
    const record = step as Record<string, unknown>
    const specialistName =
      typeof record.specialistName === 'string' ? record.specialistName.trim() : ''
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const thought =
      typeof record.thought === 'string' && record.thought.trim().length > 0
        ? record.thought.trim()
        : undefined
    const domain = isDomain(record.domain) ? record.domain : undefined

    if (!specialistName || !title) return acc

    acc.push({
      specialistName,
      title,
      thought,
      domain,
    })
    return acc
  }, [])
}

function buildThinkingMarker(steps: PersistedThinkingStep[]): string {
  const payload: ThinkingPayloadV1 = {
    version: 1,
    steps,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  return `${THINKING_MARKER_PREFIX}${encoded}${THINKING_MARKER_SUFFIX}`
}

function parseThinkingMarker(encoded: string): PersistedThinkingStep[] {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as { version?: unknown; steps?: unknown }
    if (parsed.version !== 1) return []
    return normalizeThinkingSteps(parsed.steps)
  } catch {
    return []
  }
}

export function encodeAssistantContentWithThinking(
  content: string,
  thinkingSteps?: PersistedThinkingStep[],
): string {
  const normalized = normalizeThinkingSteps(thinkingSteps)
  if (normalized.length === 0) return content
  return `${content.trimEnd()}\n\n${buildThinkingMarker(normalized)}`
}

export function decodeAssistantStoredContent(storedContent: string): {
  content: string
  thinkingSteps?: PersistedThinkingStep[]
} {
  const match = storedContent.match(THINKING_MARKER_REGEX)
  if (!match) {
    return { content: storedContent }
  }

  const decodedSteps = parseThinkingMarker(match[1])
  const content = storedContent.replace(THINKING_MARKER_REGEX, '')

  return {
    content,
    thinkingSteps: decodedSteps.length > 0 ? decodedSteps : undefined,
  }
}

export function stripAssistantStoredMetadata(storedContent: string): string {
  return decodeAssistantStoredContent(storedContent).content
}
