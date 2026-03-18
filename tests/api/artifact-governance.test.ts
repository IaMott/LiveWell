import { describe, expect, it } from 'vitest'
import { collectGovernedArtifacts } from '@/lib/ai/artifacts/governance'
import type { AgentProfile, AgentProposal } from '@/lib/ai/types'

describe('artifact governance', () => {
  it('filters saved artifacts through runtime capability contracts', () => {
    const team: AgentProfile[] = [
      {
        id: 'dietista',
        displayName: 'Dietista',
        domainTags: ['nutrition'],
        systemPrompt: 'x',
        toolsAllowed: ['artifacts.saveRecommendation'],
        decisionStyle: 'team-led',
        runtimeCapabilities: {
          canDo: [],
          cannotDo: [],
          consultTriggers: [],
          handoffTriggers: [],
          minimumInput: [],
          outputContracts: [],
          escalationRules: [],
          allowedTools: ['artifacts.saveRecommendation'],
          artifacts: [
            {
              kind: 'meal-plan',
              storageType: 'nutrition',
              description: 'Piano nutrizionale strutturato',
            },
          ],
        },
      },
    ]

    const proposals: AgentProposal[] = [
      {
        agentId: 'dietista',
        domain: 'nutrition',
        summary: 'summary',
        reasoning: 'reasoning',
        confidence: 0.9,
        recommendations: [
          {
            title: 'Piano',
            steps: ['x'],
            rationale: 'y',
            artifactsToSave: [
              { type: 'nutrition', title: 'Menu settimanale', contentMarkdown: 'ok' },
              { type: 'training', title: 'Scheda workout', contentMarkdown: 'no' },
            ],
          },
        ],
      },
    ]

    expect(collectGovernedArtifacts({ team, proposals })).toEqual([
      { type: 'nutrition', title: 'Menu settimanale', contentMarkdown: 'ok' },
    ])
  })
})
