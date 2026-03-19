import { describe, expect, it } from 'vitest'
import { collectGovernedArtifacts } from '@/lib/ai/artifacts/governance'
import type { AgentProfile, AgentProposal, ContextPack } from '@/lib/ai/types'

const baseContextPack: ContextPack = {
  user: {
    id: 'u1',
    role: 'USER',
    profile: {},
    medicalRecord: {
      completeness: {},
      missingKeys: {},
    },
  },
  history: {
    recentMessages: [],
    recentArtifacts: [],
  },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

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

    expect(collectGovernedArtifacts({ team, proposals, contextPack: baseContextPack })).toEqual([
      { type: 'nutrition', title: 'Menu settimanale', contentMarkdown: 'ok' },
    ])
  })

  it('blocks artifacts that are outside the specialist domain even if the markdown parser saw broad keywords', () => {
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
          minimumInput: ['Allergie', 'Obiettivo'],
          outputContracts: [],
          escalationRules: [],
          allowedTools: ['artifacts.saveRecommendation'],
          artifacts: [
            {
              kind: 'meal-plan',
              storageType: 'nutrition',
              description: 'Piano nutrizionale strutturato',
            },
            {
              kind: 'mindfulness-plan',
              storageType: 'mindfulness',
              description: 'Legacy parser bug',
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
              { type: 'mindfulness', title: 'Diario mindfulness', contentMarkdown: 'no' },
            ],
          },
        ],
      },
    ]

    expect(collectGovernedArtifacts({ team, proposals, contextPack: baseContextPack })).toEqual([])
  })

  it('blocks governed artifacts when required domain inputs are still missing', () => {
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
          minimumInput: ['Allergie', 'Obiettivo'],
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
            ],
          },
        ],
      },
    ]

    const contextPack: ContextPack = {
      ...baseContextPack,
      user: {
        ...baseContextPack.user,
        medicalRecord: {
          completeness: {},
          missingKeys: {
            nutrition: ['allergie', 'obiettivo'],
          },
        },
      },
    }

    expect(collectGovernedArtifacts({ team, proposals, contextPack })).toEqual([])
  })

  it('allows a hybrid gastroenterologo role to persist a nutrition artifact when runtime capabilities support it', () => {
    const team: AgentProfile[] = [
      {
        id: 'gastroenterologo',
        displayName: 'Gastroenterologo',
        domainTags: ['health'],
        systemPrompt: 'x',
        toolsAllowed: ['artifacts.saveRecommendation', 'nutrition.logMeal'],
        decisionStyle: 'team-led',
        runtimeCapabilities: {
          canDo: [],
          cannotDo: [],
          consultTriggers: [],
          handoffTriggers: [],
          minimumInput: ['Sintomi digestivi'],
          outputContracts: [],
          escalationRules: [],
          allowedTools: ['artifacts.saveRecommendation', 'nutrition.logMeal'],
          artifacts: [
            {
              kind: 'meal-plan',
              storageType: 'nutrition',
              description: 'Indicazioni nutrizionali digestive strutturate',
            },
          ],
        },
      },
    ]

    const proposals: AgentProposal[] = [
      {
        agentId: 'gastroenterologo',
        domain: 'health',
        summary: 'summary',
        reasoning: 'reasoning',
        confidence: 0.9,
        recommendations: [
          {
            title: 'Piano digestivo',
            steps: ['x'],
            rationale: 'y',
            artifactsToSave: [
              {
                type: 'nutrition',
                title: 'Menu digestivo iniziale',
                contentMarkdown: 'ok',
              },
            ],
          },
        ],
      },
    ]

    expect(collectGovernedArtifacts({ team, proposals, contextPack: baseContextPack })).toEqual([
      { type: 'nutrition', title: 'Menu digestivo iniziale', contentMarkdown: 'ok' },
    ])
  })
})
