import {
  AgentProfile,
  AgentProposal,
  ConsensusResult,
  ContextPack,
  Domain,
  ToolCall,
} from '../types'

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

function collectGatingQuestions(proposals: AgentProposal[]): string[] {
  const qs = proposals.flatMap((p) => p.questions ?? [])
  return uniq(qs).slice(0, 8)
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

function composeFinalMarkdown(
  domain: Domain,
  proposals: AgentProposal[],
  context: ContextPack,
): string {
  // Team-led voice: professionals lead; user confirms only constraints.
  const parts: string[] = []
  parts.push(`### Sintesi (${domain})`)
  const top = proposals.sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))[0]
  if (top?.summary) parts.push(top.summary)

  const gating = collectGatingQuestions(proposals)
  if (gating.length) {
    parts.push(`\n### Domande mirate (per completare i dati)`)
    parts.push(gating.map((q) => `- ${q}`).join('\n'))
  }

  // Merge recommendations
  const recs = proposals.flatMap((p) => p.recommendations ?? [])
  if (recs.length) {
    parts.push(`\n### Piano proposto dal team`)
    recs.slice(0, 3).forEach((r, idx) => {
      parts.push(`\n**${idx + 1}. ${r.title}**`)
      parts.push(r.steps.map((s) => `- ${s}`).join('\n'))
      parts.push(`\n_Razionale_: ${r.rationale}`)
      if (r.safetyNotes?.length) {
        parts.push(`\n_Note di sicurezza_:`)
        parts.push(r.safetyNotes.map((s) => `- ${s}`).join('\n'))
      }
    })
  } else if (!gating.length) {
    parts.push(`\n### Prossimo passo`)
    parts.push(
      `- Il team può proporre un percorso appena confermati i vincoli pratici (orari, attrezzatura, alimenti disponibili, preferenze non cliniche).`,
    )
  }

  // Mood hint (UI-only)
  parts.push(`\n---\n`)
  parts.push(
    `_Stato attuale_: ${context.ui.moodScore}/100 (indicatore UI basato su tracking reale).`,
  )

  return parts.join('\n')
}

export function selectAgentsForRequest(
  team: AgentProfile[],
  domain: Domain,
  maxAgents: number,
): AgentProfile[] {
  const scored = team.map((a) => ({
    agent: a,
    score: a.domainTags.includes(domain) ? 2 : a.domainTags.includes('general') ? 1 : 0,
  }))
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
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
  const domain = pickPrimaryDomain(params.domainHint, params.proposals)
  const conflicts = detectConflicts(params.proposals)

  const toolCalls = mergeToolCalls(params.proposals, new Set(params.orchestratorToolsAllowed))
  const gatingQuestions = collectGatingQuestions(params.proposals)

  const urgent = params.proposals.some((p) => p.flags?.urgentEscalation)
  const risk = urgent || params.proposals.some((p) => p.flags?.potentialRisk)

  const finalMessageMarkdown = composeFinalMarkdown(domain, params.proposals, params.contextPack)

  const artifactsToSave = params.proposals
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
      selectedAgents: uniq(params.proposals.map((p) => p.agentId)),
      conflicts,
    },
  }
}
