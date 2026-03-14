import { AgentProfile, AgentProposal, ConsensusResult, ContextPack, Domain } from '../types'
import { uniq, mergeToolCalls } from './merger'
import { enforceDomainIsolation, pickPrimaryDomain } from './domainResolver'
import { collectGatingQuestions, detectConflicts, composeFinalMarkdown } from './synthesizer'

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

  const domain = pickPrimaryDomain(params.domainHint, isolatedProposals)
  const conflicts = detectConflicts(isolatedProposals)

  const toolCalls = mergeToolCalls(isolatedProposals, new Set(params.orchestratorToolsAllowed))
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
