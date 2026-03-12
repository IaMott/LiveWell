import {
  AgentProfile,
  AgentProposal,
  ConsensusResult,
  ContextPack,
  Domain,
  ToolCall,
} from '../types'
import { applyQuestionPolicy } from '../policy/questionPolicy'

export type ConsensusEngineOptions = {
  orchestratorId: string
  maxAgents: number
  requireGatingOnMissingInfo: boolean
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function mergeToolCalls(proposals: AgentProposal[], allowedTools: Set<string>): ToolCall[] {
  const out: ToolCall[] = []
  for (const p of proposals) {
    for (const c of p.toolCalls ?? []) {
      if (!allowedTools.has(c.name)) continue
      out.push(c)
    }
  }
  // de-dupe by (name + args JSON)
  const seen = new Set<string>()
  return out.filter((c) => {
    const k = `${c.name}:${JSON.stringify(c.args)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Gap 3: enforce domain isolation — normalize agent proposals to their primary domain
function enforceDomainIsolation(
  proposals: AgentProposal[],
  team: AgentProfile[],
): { normalized: AgentProposal[]; violations: string[] } {
  const agentPrimaryDomain = new Map(
    team.map((a) => [
      a.id,
      a.domainTags.find((d) => d !== 'general') ?? a.domainTags[0] ?? 'general',
    ]),
  )
  const violations: string[] = []
  const normalized = proposals.map((p) => {
    const expected = agentPrimaryDomain.get(p.agentId)
    if (expected && expected !== 'general' && p.domain !== expected && p.domain !== 'general') {
      violations.push(`Agent ${p.agentId} (${expected}) proposed domain ${p.domain} — normalized`)
      return { ...p, domain: expected as Domain }
    }
    return p
  })
  return { normalized, violations }
}

// Collect gating questions with semantic dedup + known-data filtering
function collectGatingQuestions(
  proposals: AgentProposal[],
  contextPack: ContextPack,
  domain: Domain,
): string[] {
  const raw = proposals.flatMap((p) => p.questions ?? [])
  return applyQuestionPolicy(
    raw.map((question) => ({ question })),
    {
      domain,
      maxQuestions: 1,
      dedupeStrategy: 'semantic',
      knownData: {
        profile: (contextPack.user.profile ?? {}) as Record<string, unknown>,
        attributes: contextPack.user.attributes as
          | Record<string, Record<string, unknown>>
          | undefined,
      },
    },
  ).selectedQuestions
}

function detectConflicts(proposals: AgentProposal[]): string[] {
  // Simple conflict detector: different high-level summary intents in same domain
  const summaries = proposals.map((p) => p.summary.trim().toLowerCase()).filter(Boolean)
  if (summaries.length <= 1) return []
  // if summaries are too different, we flag; heuristic: Jaccard distance on tokens
  const tokens = summaries.map((s) => new Set(s.split(/\s+/).slice(0, 30)))
  const conflicts: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i],
        b = tokens[j]
      const inter = new Set([...a].filter((x) => b.has(x)))
      const union = new Set([...a, ...b])
      const jacc = union.size ? inter.size / union.size : 1
      if (jacc < 0.25) conflicts.push(`Potential conflict between proposals ${i + 1} and ${j + 1}`)
    }
  }
  return uniq(conflicts)
}

function pickPrimaryDomain(domainHint: Domain | undefined, proposals: AgentProposal[]): Domain {
  if (domainHint && domainHint !== 'general') return domainHint
  const counts = new Map<Domain, number>()
  for (const p of proposals) counts.set(p.domain, (counts.get(p.domain) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted.length ? sorted[0][0] : 'general'
}

// Internal summary used as context for the synthesis LLM call — never shown directly to the user.
function composeFinalMarkdown(
  domain: Domain,
  proposals: AgentProposal[],
  context: ContextPack,
): string {
  const top = proposals.sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))[0]
  const parts: string[] = [`[internal:domain=${domain}]`]

  if (top?.summary) parts.push(top.summary)

  const gating = collectGatingQuestions(proposals, context, domain)
  if (gating.length) parts.push(`[gating: ${gating.join(' | ')}]`)

  const recs = proposals.flatMap((p) => p.recommendations ?? [])
  if (recs.length) {
    recs.slice(0, 3).forEach((r) => {
      parts.push(`${r.title}: ${r.steps.slice(0, 2).join('; ')}`)
    })
  }

  return parts.join('\n')
}

export function selectAgentsForRequest(
  team: AgentProfile[],
  domain: Domain,
  maxAgents: number,
  allDomains: Domain[] = [],
  message = '',
): AgentProfile[] {
  const AGENT_COMPETENCE_HINTS: Record<string, string[]> = {
    fisioterapista: ['schiena', 'lombalgia', 'sciatica', 'postura', 'riabilitazione', 'muscolo'],
    fisiatra: ['schiena', 'dolore', 'articolazione', 'riabilitazione', 'colonna', 'muscolo'],
    'medico-dello-sport': ['infortunio', 'recupero', 'muscolo', 'allenamento', 'sport'],
    cardiologo: ['cuore', 'tachicardia', 'pressione', 'palpitazioni', 'torace'],
    gastroenterologo: ['stomaco', 'intestino', 'reflusso', 'nausea', 'digestione'],
    dermatologo: ['pelle', 'rash', 'eczema', 'dermatite'],
    dietista: ['dieta', 'calorie', 'alimentazione', 'peso'],
    endocrinologo: ['tiroide', 'glicemia', 'ormoni', 'insulina', 'metabolismo'],
    psicologo: ['ansia', 'umore', 'stress', 'panico', 'depressione'],
  }

  const MUSCULOSKELETAL_HINTS = new Set([
    'schiena',
    'lombalgia',
    'sciatica',
    'postura',
    'muscolo',
    'muscolare',
    'colonna',
    'dolore',
    'cervicale',
  ])

  const textToTokens = (text: string): Set<string> =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9àèéìòù_\-\s]/gi, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2),
    )

  const secondary = allDomains.filter((d) => d !== domain && d !== 'general')
  const lowerMessage = message.toLowerCase()
  const msgTokens = textToTokens(message)
  const hasMusculoskeletalSignal = [...msgTokens].some((t) => MUSCULOSKELETAL_HINTS.has(t))

  const scored = team.map((a) => ({
    agent: a,
    score: (() => {
      let s = 0
      if (a.domainTags.includes(domain)) s += 4
      if (a.domainTags.includes('general')) s += 1
      for (const d of secondary) if (a.domainTags.includes(d)) s += 2
      if (lowerMessage.includes(a.id.toLowerCase())) s += 2
      if (lowerMessage.includes(a.displayName.toLowerCase())) s += 2

      const competenceHints = AGENT_COMPETENCE_HINTS[a.id] ?? []
      const competenceMatches = competenceHints.filter((h) => msgTokens.has(h)).length
      if (competenceMatches > 0) s += competenceMatches * 3

      if (
        hasMusculoskeletalSignal &&
        (a.id === 'fisioterapista' || a.id === 'fisiatra' || a.id === 'medico-dello-sport')
      ) {
        s += 4
      }
      if (hasMusculoskeletalSignal && a.id === 'fisioterapista') {
        s += 1
      }
      return s
    })(),
  }))
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id))
    .slice(0, maxAgents)
    .map((x) => x.agent)
}

export function runConsensus(params: {
  opts: ConsensusEngineOptions
  team: AgentProfile[]
  proposals: AgentProposal[]
  domainHint?: Domain
  contextPack: ContextPack
  orchestratorToolsAllowed: string[]
}): ConsensusResult {
  // Gap 3: enforce domain isolation before consensus
  const { normalized: isolatedProposals, violations: domainViolations } = enforceDomainIsolation(
    params.proposals,
    params.team,
  )

  const domain = pickPrimaryDomain(params.domainHint, isolatedProposals)
  const conflicts = detectConflicts(isolatedProposals)

  const toolCalls = mergeToolCalls(isolatedProposals, new Set(params.orchestratorToolsAllowed))
  // Gap 2: semantic dedup + known-data filtering
  const gatingQuestions = collectGatingQuestions(isolatedProposals, params.contextPack, domain)

  const urgent = isolatedProposals.some((p) => p.flags?.urgentEscalation)
  const risk = urgent || isolatedProposals.some((p) => p.flags?.potentialRisk)

  const finalMessageMarkdown = composeFinalMarkdown(domain, isolatedProposals, params.contextPack)

  const artifactsToSave = isolatedProposals
    .flatMap((p) => (p.recommendations ?? []).flatMap((r) => r.artifactsToSave ?? []))
    .slice(0, 5)
    .map((a) => ({ type: a.type, title: a.title, contentMarkdown: a.contentMarkdown }))

  return {
    domain,
    finalMessageMarkdown,
    toolCallsToExecute: toolCalls,
    gatingQuestions: gatingQuestions.length ? gatingQuestions : undefined,
    ui: {
      domainIcon: domain,
      moodScore: params.contextPack.ui.moodScore,
      sectionScores: params.contextPack.ui.sectionScores,
    },
    safety: {
      escalation: urgent ? 'urgent' : risk ? 'recommend-professional' : 'none',
      disclaimers: risk
        ? [
            'Questo contenuto non sostituisce un professionista sanitario. Se hai sintomi importanti o dubbi clinici, contatta un professionista reale.',
          ]
        : undefined,
    },
    artifactsToSave: artifactsToSave.length ? artifactsToSave : undefined,
    debug: {
      selectedAgents: uniq(isolatedProposals.map((p) => p.agentId)),
      conflicts: [...conflicts, ...domainViolations],
    },
  }
}
