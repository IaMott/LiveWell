import type {
  AgentInput,
  AgentProfile,
  CanonicalCaseStateSnapshot,
  ContextPack,
  Domain,
  ToolCall,
} from '../types'
import type { LlmClient } from './agentExecution'
import { NEW_TOPIC_PATTERN } from './routingConstants'

export type RoutingResolutionSource =
  | 'input.domainHint'
  | 'llm_context'
  | 'snapshot_context'
  | 'history_context'
  | 'domainDetection'

export type ContextualRoutingResolution = {
  detectedDomain: Domain
  allDomains: Domain[]
  preferredAgentIds: string[]
  source: RoutingResolutionSource
  reasoning: string | null
}

type LlmRoutingResult = {
  primaryDomain: Domain
  allDomains: Domain[]
  preferredAgentIds: string[]
  confidence: number | null
  reasoning: string | null
}

const VALID_DOMAINS: Domain[] = [
  'general',
  'nutrition',
  'health',
  'training',
  'mindfulness',
  'inspiration',
  'coordination',
]

const ROUTING_LLM_TIMEOUT_MS = 2500

const CONTINUATION_PATTERN =
  /\b(continuiamo|continua|proseguiamo|prosegui|riprendiamo|riprendi|torniamo|torniamo lì|restiamo|come dicevi|da dove eravamo rimasti|continua pure)\b/i

const ROUTING_SYSTEM_PROMPT = `Sei un router multi-dominio per LiveWell.
Scegli il dominio principale e gli eventuali domini secondari per il turno corrente.

Regole:
- usa prima contesto conversazionale, stato canonico, panel attivi, summary recenti e bisogni aperti
- usa segnali lessicali/keyword solo come supporto, mai come motore principale
- se il messaggio e' un follow-up, mantieni i domini gia' attivi salvo chiaro cambio tema
- proponi agenti preferiti solo se davvero coerenti con il panel attivo o col contesto

Restituisci SOLO JSON valido:
{
  "primaryDomain": "general|nutrition|health|training|mindfulness|inspiration|coordination",
  "allDomains": ["..."],
  "preferredAgentIds": ["..."],
  "confidence": 0.0,
  "reasoning": "breve spiegazione"
}`

function isDomain(value: unknown): value is Domain {
  return typeof value === 'string' && VALID_DOMAINS.includes(value as Domain)
}

function uniqueDomains(values: Array<Domain | null | undefined>): Domain[] {
  const out: Domain[] = []
  for (const value of values) {
    if (!value || !isDomain(value) || out.includes(value)) continue
    out.push(value)
  }
  return out
}

function getSnapshotDomains(snapshot: CanonicalCaseStateSnapshot | null | undefined): Domain[] {
  if (!snapshot) return []
  return uniqueDomains([
    snapshot.leadDomain,
    ...snapshot.activeDomains,
    ...snapshot.domainPanels.map((panel) => panel.domain),
  ])
}

function getSnapshotPreferredAgents(
  snapshot: CanonicalCaseStateSnapshot | null | undefined,
  domains: Domain[],
): string[] {
  if (!snapshot) return []
  const allowed = new Set(domains)
  const out: string[] = []
  for (const panel of snapshot.domainPanels) {
    if (!allowed.has(panel.domain)) continue
    if (!panel.selectedAgentId || out.includes(panel.selectedAgentId)) continue
    out.push(panel.selectedAgentId)
  }
  return out
}

function getHistoryDomains(contextPack: ContextPack): Domain[] {
  const summaryDomains = (contextPack.history.recentConversationSummaries ?? [])
    .slice(-3)
    .map((entry) => entry.domain)
    .filter(isDomain)

  const sectionDomains = Object.entries(contextPack.ui.sectionScores ?? {})
    .filter(
      (entry): entry is [Domain, number] => isDomain(entry[0]) && typeof entry[1] === 'number',
    )
    .filter(([, score]) => score >= 55)
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain)

  return uniqueDomains([...summaryDomains, ...sectionDomains])
}

function isContinuationMessage(message: string): boolean {
  const trimmed = message.trim()
  return (
    CONTINUATION_PATTERN.test(trimmed) ||
    (!NEW_TOPIC_PATTERN.test(trimmed) && trimmed.length > 0 && trimmed.length <= 40)
  )
}

function domainsFromExtraction(toolCalls: ToolCall[]): Domain[] {
  return uniqueDomains(
    toolCalls
      .map((call) => {
        if (call.name !== 'user.setAttribute' || !call.args || typeof call.args !== 'object')
          return null
        return (call.args as { domain?: unknown }).domain as Domain | null
      })
      .filter(isDomain),
  )
}

function buildRoutingUserPayload(params: {
  message: string
  contextPack: ContextPack
  snapshot: CanonicalCaseStateSnapshot | null | undefined
  heuristicDetectedDomain: Domain
  heuristicAllDomains: Domain[]
  team: AgentProfile[]
}): string {
  const { message, contextPack, snapshot, heuristicDetectedDomain, heuristicAllDomains, team } =
    params

  return JSON.stringify({
    message,
    activeState: snapshot
      ? {
          leadDomain: snapshot.leadDomain,
          activeDomains: snapshot.activeDomains,
          panels: snapshot.domainPanels.map((panel) => ({
            domain: panel.domain,
            selectedAgentId: panel.selectedAgentId,
            status: panel.status,
            pendingNeeds: panel.pendingNeeds,
          })),
          conversationFocus: snapshot.conversationFocus,
          coordinationState: snapshot.coordinationState,
          sharedOpenQuestions: snapshot.sharedOpenQuestions,
          domainOpenQuestions: snapshot.domainOpenQuestions,
        }
      : null,
    medicalRecord: contextPack.user.medicalRecord ?? null,
    sectionScores: contextPack.ui.sectionScores ?? null,
    recentMessages: contextPack.history.recentMessages.slice(-5),
    recentSummaries: (contextPack.history.recentConversationSummaries ?? []).slice(-3),
    recentFiles: (contextPack.files ?? []).slice(-3).map((file) => ({
      filename: file.filename,
      notes: file.notes ?? null,
      extractedText: (file.extractedText ?? '').slice(0, 220),
    })),
    heuristicFallback: {
      detectedDomain: heuristicDetectedDomain,
      allDomains: heuristicAllDomains,
    },
    team: team.map((agent) => ({
      id: agent.id,
      displayName: agent.displayName,
      domainTags: agent.domainTags,
    })),
  })
}

function parseLlmRoutingResult(text: string, team: AgentProfile[]): LlmRoutingResult | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (!isDomain(parsed.primaryDomain)) return null

    const allDomains = Array.isArray(parsed.allDomains)
      ? uniqueDomains(parsed.allDomains.filter(isDomain))
      : []
    const preferredAgentIds = Array.isArray(parsed.preferredAgentIds)
      ? parsed.preferredAgentIds
          .filter((value): value is string => typeof value === 'string')
          .filter((id, index, arr) => arr.indexOf(id) === index)
          .filter((id) => team.some((agent) => agent.id === id))
      : []
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : null
    const reasoning =
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
        ? parsed.reasoning.trim()
        : null

    return {
      primaryDomain: parsed.primaryDomain,
      allDomains: uniqueDomains([parsed.primaryDomain, ...allDomains]),
      preferredAgentIds,
      confidence,
      reasoning,
    }
  } catch {
    return null
  }
}

export async function inferRoutingWithLlm(params: {
  llm: LlmClient
  team: AgentProfile[]
  input: AgentInput
  heuristicDetectedDomain: Domain
  heuristicAllDomains: Domain[]
}): Promise<LlmRoutingResult | null> {
  const { llm, team, input, heuristicDetectedDomain, heuristicAllDomains } = params

  try {
    const response = await Promise.race([
      llm.complete({
        system: ROUTING_SYSTEM_PROMPT,
        user: buildRoutingUserPayload({
          message: input.message,
          contextPack: input.contextPack,
          snapshot: input.caseStateSnapshot,
          heuristicDetectedDomain,
          heuristicAllDomains,
          team,
        }),
        format: 'text',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('routing llm timeout')), ROUTING_LLM_TIMEOUT_MS),
      ),
    ])

    const parsed = parseLlmRoutingResult(response.text, team)
    if (!parsed) return null
    if ((parsed.confidence ?? 0.6) < 0.45) return null
    return parsed
  } catch {
    return null
  }
}

export function resolveContextualRouting(params: {
  input: AgentInput
  heuristicDetectedDomain: Domain
  heuristicAllDomains: Domain[]
  llmExtractionCalls: ToolCall[]
  llmRouting: LlmRoutingResult | null
}): ContextualRoutingResolution {
  const { input, heuristicDetectedDomain, heuristicAllDomains, llmExtractionCalls, llmRouting } =
    params

  if (input.domainHint) {
    const hintedDomains = uniqueDomains([input.domainHint, ...heuristicAllDomains])
    return {
      detectedDomain: input.domainHint,
      allDomains: hintedDomains,
      preferredAgentIds: getSnapshotPreferredAgents(input.caseStateSnapshot, hintedDomains),
      source: 'input.domainHint',
      reasoning: 'domain_hint_explicit',
    }
  }

  if (llmRouting) {
    const mergedDomains = uniqueDomains([
      llmRouting.primaryDomain,
      ...llmRouting.allDomains,
      ...domainsFromExtraction(llmExtractionCalls),
    ])
    return {
      detectedDomain: llmRouting.primaryDomain,
      allDomains: mergedDomains.length > 0 ? mergedDomains : [llmRouting.primaryDomain],
      preferredAgentIds:
        llmRouting.preferredAgentIds.length > 0
          ? llmRouting.preferredAgentIds
          : getSnapshotPreferredAgents(input.caseStateSnapshot, mergedDomains),
      source: 'llm_context',
      reasoning: llmRouting.reasoning,
    }
  }

  const snapshotDomains = getSnapshotDomains(input.caseStateSnapshot)
  const extractedDomains = domainsFromExtraction(llmExtractionCalls)
  const historyDomains = getHistoryDomains(input.contextPack)
  const continuation = isContinuationMessage(input.message)

  if (continuation && snapshotDomains.length > 0) {
    const allDomains = uniqueDomains([...snapshotDomains, ...extractedDomains])
    return {
      detectedDomain:
        input.caseStateSnapshot?.leadDomain ?? snapshotDomains[0] ?? heuristicDetectedDomain,
      allDomains,
      preferredAgentIds: getSnapshotPreferredAgents(input.caseStateSnapshot, allDomains),
      source: 'snapshot_context',
      reasoning: 'snapshot_continuation',
    }
  }

  if (continuation && historyDomains.length > 0) {
    return {
      detectedDomain: historyDomains[0]!,
      allDomains: uniqueDomains([...historyDomains, ...extractedDomains]),
      preferredAgentIds: [],
      source: 'history_context',
      reasoning: 'history_continuation',
    }
  }

  const mergedHeuristicDomains = uniqueDomains([
    heuristicDetectedDomain,
    ...heuristicAllDomains,
    ...extractedDomains,
  ])
  return {
    detectedDomain: heuristicDetectedDomain,
    allDomains:
      mergedHeuristicDomains.length > 0 ? mergedHeuristicDomains : [heuristicDetectedDomain],
    preferredAgentIds: getSnapshotPreferredAgents(input.caseStateSnapshot, mergedHeuristicDomains),
    source: 'domainDetection',
    reasoning: extractedDomains.length > 0 ? 'heuristic_plus_llm_extraction' : 'heuristic_fallback',
  }
}
