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
})
