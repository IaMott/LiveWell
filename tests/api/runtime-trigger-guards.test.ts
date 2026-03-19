import { describe, expect, it } from 'vitest'
import {
  findCapabilityConsultTarget,
  findPermanentHandoffTriggerReason,
} from '@/lib/ai/capabilities/registry'
import type { AgentProfile } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'life-organizer',
    displayName: 'Life Organizer',
    domainTags: ['coordination', 'inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [
        'Diagnosticare ADHD, ansia, OCD, hoarding o altri disturbi (→ psicologo del team).',
      ],
      consultTriggers: [
        'Diagnosticare ADHD, ansia, OCD, hoarding o altri disturbi (→ psicologo del team).',
      ],
      handoffTriggers: [
        'Disorganizzazione grave con segnali di ADHD -> co-gestione con psicologo del team.',
      ],
      minimumInput: [],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'sleep-coach',
    displayName: 'Sleep Coach',
    domainTags: ['health', 'mindfulness'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: [
        'OSAS sospetta (russamento + apnee + ESS >10) -> invio urgente a pneumologo/ORL per polisonnografia.',
      ],
      handoffTriggers: [
        'OSAS sospetta (russamento + apnee + ESS >10) -> invio urgente a pneumologo/ORL per polisonnografia.',
      ],
      minimumInput: [],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'psicologo',
    displayName: 'Psicologo',
    domainTags: ['mindfulness'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: [
        'Ansia intensa, stress persistente o sonno deteriorato -> psicologo del team.',
      ],
      handoffTriggers: ['Ansia intensa o disagio psicologico persistente -> handoff mindfulness.'],
      minimumInput: [],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'consulente-legale',
    displayName: 'Consulente Legale',
    domainTags: ['inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Separazione, causa o contratto -> consulente legale del team.'],
      handoffTriggers: ['Caso legale dominante -> handoff inspiration.'],
      minimumInput: [],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'financial-planner',
    displayName: 'Financial Planner',
    domainTags: ['inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Debiti, spese fuori controllo o ansia finanziaria -> financial planner.'],
      handoffTriggers: ['Gestione finanziaria dominante -> handoff inspiration.'],
      minimumInput: [],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'cardiologo',
    displayName: 'Cardiologo',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Dolore toracico, fiato corto o palpitazioni -> cardiologo del team.'],
      handoffTriggers: ['Sintomi cardiologici dominanti -> handoff health.'],
      minimumInput: [],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
]

describe('runtime trigger guards', () => {
  it('does not surface the unrelated OSAS trigger for generic burnout text', () => {
    const reason = findPermanentHandoffTriggerReason({
      team,
      ownerAgentId: 'life-organizer',
      consultTargetAgentId: 'sleep-coach',
      detectedDomain: 'mindfulness',
      message: 'sono in burnout e ho ansia alta',
    })

    expect(reason).not.toContain('OSAS')
    expect(reason).toContain('psicologo')
  })

  it('prefers the semantically aligned consult target when owner trigger names a specialist explicitly', () => {
    const out = findCapabilityConsultTarget({
      team,
      ownerAgentId: 'life-organizer',
      detectedDomain: 'mindfulness',
      message: 'sono in burnout, ansia alta e non riesco a organizzarmi',
    })

    expect(out).toMatchObject({
      agentId: 'psicologo',
    })
    expect(out?.reason).toContain('psicologo')
  })

  it('routes implicit legal separation cases to the legal consultant', () => {
    const out = findCapabilityConsultTarget({
      team,
      ownerAgentId: 'life-organizer',
      detectedDomain: 'inspiration',
      message: 'mi sto separando e ci sono problemi legali con gli accordi',
    })

    expect(out).toMatchObject({ agentId: 'consulente-legale' })
  })

  it('routes debt plus anxiety cases to financial planning instead of a weak fallback', () => {
    const out = findCapabilityConsultTarget({
      team,
      ownerAgentId: 'life-organizer',
      detectedDomain: 'inspiration',
      message: 'ho debiti, spese fuori controllo e sto andando in ansia',
    })

    expect(out).toMatchObject({ agentId: 'financial-planner' })
  })

  it('prefers a health specialist for critical chest symptoms', () => {
    const out = findCapabilityConsultTarget({
      team,
      ownerAgentId: 'life-organizer',
      detectedDomain: 'health',
      message: 'ho dolore toracico e fiato corto da stamattina',
    })

    expect(out).toMatchObject({ agentId: 'cardiologo' })
    expect(out?.reason.toLowerCase()).toContain('torac')
  })
})
