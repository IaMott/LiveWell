import { describe, expect, it } from 'vitest'
import { deriveActiveSpecialistFromCaseState } from '@/lib/ai/case/compat'
import { advanceCaseState } from '@/lib/ai/case/protocol'
import type { AgentProfile } from '@/lib/ai/types'

const team: AgentProfile[] = [
  {
    id: 'dietista',
    displayName: 'Dietista',
    domainTags: ['nutrition'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: ['Fuori competenza clinica -> specialista health'],
      consultTriggers: ['Sintomi clinici o dominio health -> specialista health'],
      handoffTriggers: ['Se il dominio health/training diventa prevalente -> handoff'],
      minimumInput: ['Obiettivo', 'Abitudini'],
      outputContracts: [],
      escalationRules: ['Sintomi clinici -> invio'],
      allowedTools: [],
      artifacts: [
        {
          kind: 'meal-plan',
          storageType: 'nutrition',
          description: 'Piano nutrizionale strutturato',
        },
      ],
    },
  },
  {
    id: 'fisioterapista',
    displayName: 'Fisioterapista',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Dolore o sintomi health/training -> posso prendere in carico il consulto'],
      handoffTriggers: ['Quando il caso diventa health/training prevalente -> handoff'],
      minimumInput: ['Sintomi', 'Durata'],
      outputContracts: [],
      escalationRules: ['Red flag cliniche -> valutazione medica'],
      allowedTools: [],
      artifacts: [
        {
          kind: 'training-plan',
          storageType: 'training',
          description: 'Programmazione motoria',
        },
      ],
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
      consultTriggers: ['Stress o sonno -> specialista mindfulness'],
      handoffTriggers: ['Domini mindfulness prevalenti -> handoff'],
      minimumInput: ['Stress'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [
        {
          kind: 'mindfulness-plan',
          storageType: 'mindfulness',
          description: 'Percorso mindfulness',
        },
      ],
    },
  },
  {
    id: 'orchestratore',
    displayName: 'Orchestratore',
    domainTags: ['coordination'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: [],
      handoffTriggers: [],
      minimumInput: ['Richiesta utente'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
]

describe('case protocol vertical slice', () => {
  it('initializes a canonical case state with owner and active speaker aligned', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'c1',
      message: 'vorrei migliorare la dieta',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('dietista')
    expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
    expect(out.caseState.protocolState).toBe('owner_active')
    expect(out.events[0]?.kind).toBe('initialized')
  })

  it('uses a neutral owner for generic messages instead of assigning the first specialist arbitrarily', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'generic-1',
      message: 'ciao',
      detectedDomain: 'general',
      allDomains: ['general'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('orchestratore')
    expect(out.caseState.activeSpeakerAgentId).toBe('orchestratore')
    expect(out.caseState.protocolState).toBe('owner_active')
  })

  it('opens a real consult with temporary takeover while preserving owner', () => {
    const initial = advanceCaseState({
      current: null,
      conversationId: 'c2',
      message: 'vorrei migliorare la dieta',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    }).caseState

    const consult = advanceCaseState({
      current: initial,
      conversationId: 'c2',
      message: 'voglio parlare con il fisioterapista',
      detectedDomain: 'general',
      allDomains: ['general'],
      team,
    })

    expect(consult.caseState.ownerAgentId).toBe('dietista')
    expect(consult.caseState.activeSpeakerAgentId).toBe('fisioterapista')
    expect(consult.caseState.protocolState).toBe('consult_active_takeover')
    expect(consult.caseState.consultTargetAgentId).toBe('fisioterapista')
    expect(consult.caseState.returnTargetAgentId).toBe('dietista')
    expect(consult.events.map((e) => e.kind)).toEqual(['consult_requested', 'takeover_started'])
  })

  it('returns the baton to the owner on the next turn when the consult is not continued', () => {
    const consultState = {
      conversationId: 'c3',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      consultReason: 'user_requested_specialist',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c3',
      message: 'ok grazie',
      detectedDomain: 'training',
      allDomains: ['training'],
      team,
    })

    expect(out.caseState.protocolState).toBe('owner_active')
    expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
    expect(out.events.map((e) => e.kind)).toEqual(['return_baton'])
  })

  it('does not allow a second active consult while a takeover is already active', () => {
    const consultState = {
      conversationId: 'c4',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      consultReason: 'user_requested_specialist',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c4',
      message: 'voglio parlare con lo psicologo',
      detectedDomain: 'mindfulness',
      allDomains: ['mindfulness'],
      team,
    })

    expect(out.caseState.protocolState).toBe('owner_active')
    expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
    expect(out.caseState.consultTargetAgentId).toBeUndefined()
  })

  it('opens a handoff checkpoint when the consult domain becomes dominant', () => {
    const consultState = {
      conversationId: 'c4b',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      consultReason: 'user_requested_specialist',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c4b',
      message: 'continuiamo con il recupero del ginocchio e gli esercizi',
      detectedDomain: 'training',
      allDomains: ['training'],
      team,
    })

    expect(out.caseState.protocolState).toBe('handoff_pending_user')
    expect(out.caseState.pendingHandoffAgentId).toBe('fisioterapista')
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_requested'])
    expect(out.events[0]?.reason).toContain('handoff')
  })

  it('does not use unrelated owner triggers as consult reason when the target trigger is the real match', () => {
    const initial = advanceCaseState({
      current: null,
      conversationId: 'c-trigger',
      message: 'voglio parlare con il dietista',
      detectedDomain: 'general',
      allDomains: ['general'],
      team,
    }).caseState

    const consult = advanceCaseState({
      current: initial,
      conversationId: 'c-trigger',
      message: 'ho dolore al ginocchio durante esercizio',
      detectedDomain: 'training',
      allDomains: ['training'],
      team,
    })

    expect(consult.caseState.protocolState).toBe('consult_active_takeover')
    expect(consult.caseState.consultTargetAgentId).toBe('fisioterapista')
    expect(consult.caseState.consultReason).toContain('Dolore')
    expect(consult.caseState.consultReason).not.toContain('clinica')
  })

  it('completes permanent handoff on the next checkpoint turn', () => {
    const pendingState = {
      conversationId: 'c4c',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      protocolState: 'handoff_pending_user' as const,
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      consultReason: 'user_requested_specialist',
      pendingHandoffAgentId: 'fisioterapista',
      checkpointReason: 'domain_shift_confirmed_by_runtime',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: pendingState,
      conversationId: 'c4c',
      message: 'ok continuiamo',
      detectedDomain: 'training',
      allDomains: ['training'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('fisioterapista')
    expect(out.caseState.activeSpeakerAgentId).toBe('fisioterapista')
    expect(out.caseState.protocolState).toBe('owner_active')
    expect(out.caseState.handoffCount).toBe(1)
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_completed'])
  })

  it('derives activeSpecialist from canonical case state instead of using a separate source', () => {
    const active = deriveActiveSpecialistFromCaseState(
      {
        conversationId: 'c5',
        ownerAgentId: 'dietista',
        activeSpeakerAgentId: 'fisioterapista',
        protocolState: 'consult_active_takeover',
        consultTargetAgentId: 'fisioterapista',
        returnTargetAgentId: 'dietista',
        consultReason: 'user_requested_specialist',
        takeoverTurns: 1,
        loopCount: 1,
        handoffCount: 0,
      },
      team,
    )

    expect(active).toMatchObject({
      id: 'fisioterapista',
      displayName: 'Fisioterapista',
      domains: ['training', 'health'],
    })
  })

  it('opens a consult automatically when runtime consult triggers detect a domain shift', () => {
    const current = advanceCaseState({
      current: null,
      conversationId: 'c6',
      message: 'vorrei migliorare la dieta',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    }).caseState

    const out = advanceCaseState({
      current,
      conversationId: 'c6',
      message: 'ho dolore toracico e fiato corto durante gli esercizi',
      detectedDomain: 'health',
      allDomains: ['health', 'training'],
      team,
    })

    expect(out.caseState.protocolState).toBe('consult_active_takeover')
    expect(out.caseState.ownerAgentId).toBe('dietista')
    expect(out.caseState.activeSpeakerAgentId).toBe('fisioterapista')
    expect(out.events.map((e) => e.kind)).toEqual(['consult_requested', 'takeover_started'])
    expect(out.events[0]?.reason).toContain('health')
  })
})
