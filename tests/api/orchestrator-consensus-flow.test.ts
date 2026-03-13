import { describe, expect, it, vi } from 'vitest'
import type { AgentProfile, AgentProposal, ConsensusResult, ContextPack } from '@/lib/ai/types'
import { executeConsensusFlow } from '@/lib/ai/orchestrator/consensusFlow'

const { runConsensusMock } = vi.hoisted(() => ({
  runConsensusMock: vi.fn(),
}))

vi.mock('@/lib/ai/consensus/consensusEngine', () => ({
  runConsensus: runConsensusMock,
}))

const team: AgentProfile[] = [
  {
    id: 'mmg',
    displayName: 'MMG',
    domainTags: ['health', 'general'],
    systemPrompt: 'Sei un medico.',
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  },
]

const contextPack: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {}, attributes: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { health: 60 } },
}

const round2Proposals: AgentProposal[] = [
  {
    agentId: 'mmg',
    domain: 'health',
    summary: 'summary',
    reasoning: 'reasoning',
    questions: ['q1'],
    recommendations: [],
    toolCalls: [],
    confidence: 0.9,
  },
]

describe('consensus flow boundary', () => {
  it('packages the minimum context and returns structured consensus output', () => {
    const consensus: ConsensusResult = {
      domain: 'health',
      finalMessageMarkdown: 'final',
      toolCallsToExecute: [],
      ui: { domainIcon: 'health', moodScore: 50, sectionScores: { health: 60 } },
      safety: { escalation: 'none' },
      gatingQuestions: ['Hai dolore?'],
      debug: { selectedAgents: ['mmg'], conflicts: [] },
    }
    runConsensusMock.mockReturnValueOnce(consensus)

    const out = executeConsensusFlow({
      team,
      round2Proposals,
      domainHint: 'health',
      contextPack,
      orchestratorToolsAllowed: ['user.setAttribute'],
    })

    expect(out).toEqual({ consensus })
    expect(runConsensusMock).toHaveBeenCalledTimes(1)
    expect(runConsensusMock).toHaveBeenCalledWith({
      opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
      team,
      proposals: round2Proposals,
      domainHint: 'health',
      contextPack,
      orchestratorToolsAllowed: ['user.setAttribute'],
    })
  })
})
