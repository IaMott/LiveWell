import { AgentProposal, ContextPack, Domain } from '../types'
import { applyQuestionPolicy } from '../policy/questionPolicy'
import { uniq } from './merger'

/** Collect gating questions with semantic dedup + known-data filtering.
 *
 * P9 — maxQuestions raised from 1 to 3 so the downstream synthesis batch logic
 * (synthesis.ts → rawMissingQuestions.slice(0, 3)) actually has multiple questions
 * to pose in a single turn when MVD is missing. Previous value of 1 made the
 * `gatingQuestionCount > 1` branch in buildSystemPrompt unreachable, so the
 * "ask 3 baseline questions naturally" behavior was dead code.
 */
export function collectGatingQuestions(
  proposals: AgentProposal[],
  contextPack: ContextPack,
  domain: Domain,
): string[] {
  const raw = proposals.flatMap((p) => p.questions ?? [])
  return applyQuestionPolicy(
    raw.map((question) => ({ question })),
    {
      domain,
      maxQuestions: 3,
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

/** Jaccard-based conflict detector across proposal summaries. */
export function detectConflicts(proposals: AgentProposal[]): string[] {
  const summaries = proposals.map((p) => p.summary.trim().toLowerCase()).filter(Boolean)
  if (summaries.length <= 1) return []
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

/**
 * Compose internal summary used as context for the synthesis LLM call.
 * Never shown directly to the user.
 */
export function composeFinalMarkdown(
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
