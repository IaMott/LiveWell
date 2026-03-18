import { AgentProfile, AgentProposal, ConsensusResult, ContextPack, Domain } from '../types'
import { collectGovernedArtifacts } from '../artifacts/governance'
import { uniq, mergeToolCalls } from './merger'
import { enforceDomainIsolation, pickPrimaryDomain } from './domainResolver'
import { collectGatingQuestions, detectConflicts, composeFinalMarkdown } from './synthesizer'
import { rankByWeight, mergeToolCallsWeighted, detectWeightedConflicts } from './weightedMerge'

export type ConsensusEngineOptions = {
  orchestratorId: string
  maxAgents: number
  requireGatingOnMissingInfo: boolean
}

export function runConsensus(params: {
  opts: ConsensusEngineOptions
  team: AgentProfile[]
  proposals: AgentProposal[]
  domainHint?: Domain
  contextPack: ContextPack
  orchestratorToolsAllowed: string[]
}): ConsensusResult {
  const { normalized: isolatedProposals, violations: domainViolations } = enforceDomainIsolation(
    params.proposals,
    params.team,
  )

  // Rank proposals by confidence weight before any merge/synthesis.
  // Fallback proposals (confidence=0) are stripped out here.
  const rankedProposals = rankByWeight(isolatedProposals)
  // For domain/gating/synthesis we use ranked (active) proposals;
  // for legacy conflict detection we keep isolated for backward compat.
  const effectiveProposals = rankedProposals.length > 0 ? rankedProposals : isolatedProposals

  const domain = pickPrimaryDomain(params.domainHint, effectiveProposals)
  const baseConflicts = detectConflicts(effectiveProposals)
  const weightedConflicts = detectWeightedConflicts(effectiveProposals)
  const conflicts = [...new Set([...baseConflicts, ...weightedConflicts])]

  // Use weighted tool call merge to prefer high-confidence agents
  const weightedCalls = mergeToolCallsWeighted(effectiveProposals)
  const toolCalls: NonNullable<AgentProposal['toolCalls']> =
    weightedCalls.length > 0
      ? weightedCalls
      : mergeToolCalls(effectiveProposals, new Set(params.orchestratorToolsAllowed))

  const gatingQuestions = collectGatingQuestions(effectiveProposals, params.contextPack, domain)

  const urgent = effectiveProposals.some((p) => p.flags?.urgentEscalation)
  const risk = urgent || effectiveProposals.some((p) => p.flags?.potentialRisk)

  const finalMessageMarkdown = composeFinalMarkdown(domain, effectiveProposals, params.contextPack)

  const artifactsToSave = collectGovernedArtifacts({
    team: params.team,
    proposals: effectiveProposals,
  })

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
      selectedAgents: uniq(effectiveProposals.map((p) => p.agentId)),
      conflicts: [...conflicts, ...domainViolations],
    },
  }
}
