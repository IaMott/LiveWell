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
    id: 'chef',
    displayName: 'Chef',
    domainTags: ['nutrition'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Dieta clinica o vincoli nutrizionali -> dietista del team'],
      handoffTriggers: [
        'Quando la pianificazione nutrizionale clinica diventa prevalente -> handoff',
      ],
      minimumInput: ['Preferenze'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
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
    id: 'cardiologo',
    displayName: 'Cardiologo',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Dolore toracico, tachicardia o pressione alta -> cardiologo del team'],
      handoffTriggers: ['Caso cardiologico dominante -> handoff health'],
      minimumInput: ['Sintomi cardiologici'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'gastroenterologo',
    displayName: 'Gastroenterologo',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Gonfiore, gastrite o digestione difficile -> gastroenterologo del team'],
      handoffTriggers: ['Caso gastroenterologico dominante -> handoff health'],
      minimumInput: ['Sintomi digestivi'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'medico-dello-sport',
    displayName: 'Medico dello Sport',
    domainTags: ['training', 'health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Infortunio o dolore sport-specific -> medico dello sport del team'],
      handoffTriggers: ['Caso sportivo dominante -> handoff training'],
      minimumInput: ['Contesto sportivo'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'dermatologo',
    displayName: 'Dermatologo',
    domainTags: ['health'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Sfoghi cutanei persistenti o prurito -> dermatologo del team'],
      handoffTriggers: ['Caso dermatologico dominante -> handoff health'],
      minimumInput: ['Sintomi cutanei'],
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
    id: 'consulente-legale',
    displayName: 'Consulente Legale',
    domainTags: ['inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Separazione o accordi legali -> consulente legale del team'],
      handoffTriggers: ['Caso legale dominante -> handoff inspiration'],
      minimumInput: ['Contesto legale'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'relationship-coach',
    displayName: 'Relationship Coach',
    domainTags: ['mindfulness', 'inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: [
        'Separazione complessa o conflitti con implicazioni legali -> consulente legale del team',
      ],
      handoffTriggers: ['Quando la componente legale diventa dominante -> handoff inspiration'],
      minimumInput: ['Obiettivo relazionale'],
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
      consultTriggers: ['Debiti, mutuo o spese fuori controllo -> financial planner del team'],
      handoffTriggers: ['Caso economico dominante -> handoff inspiration'],
      minimumInput: ['Contesto economico'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'life-organizer',
    displayName: 'Life Organizer',
    domainTags: ['coordination', 'inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Sovraccarico pratico o organizzativo -> life-organizer del team'],
      handoffTriggers: ['Caso coordination dominante -> handoff coordination'],
      minimumInput: ['Contesto pratico'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
    },
  },
  {
    id: 'analista-contesto',
    displayName: 'Analista Contesto',
    domainTags: ['coordination', 'inspiration'],
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
    runtimeCapabilities: {
      canDo: [],
      cannotDo: [],
      consultTriggers: ['Caso trasversale e confuso -> life-organizer del team'],
      handoffTriggers: ['Caso trasversale dominante -> handoff coordination'],
      minimumInput: ['Panoramica caso'],
      outputContracts: [],
      escalationRules: [],
      allowedTools: [],
      artifacts: [],
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

  it('picks the dietista for implicit nutrition monodomain cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-nutrition-1',
      message: 'piano alimentare per dimagrire',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('dietista')
    expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
  })

  it('picks the dietista for softer implicit nutrition requests', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-nutrition-2',
      message: 'vorrei mangiare meglio',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('dietista')
    expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
  })

  it('picks the cardiologo for implicit critical health monodomain cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-health-1',
      message: 'tachicardia e pressione alta da stamattina',
      detectedDomain: 'health',
      allDomains: ['health'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('cardiologo')
  })

  it('picks the dermatologo for persistent skin eruptions', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-health-derma-1',
      message: 'sfoghi cutanei persistenti con rash e prurito',
      detectedDomain: 'health',
      allDomains: ['health'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('dermatologo')
  })

  it('picks the legal consultant for implicit legal inspiration cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-legal-1',
      message: "mi sto separando e servono accordi per l'affido",
      detectedDomain: 'inspiration',
      allDomains: ['inspiration'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('consulente-legale')
  })

  it('picks financial planning for implicit debt and anxiety inspiration cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-finance-1',
      message: 'ho debiti e sto andando in ansia',
      detectedDomain: 'inspiration',
      allDomains: ['inspiration'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('financial-planner')
  })

  it('picks gastroenterology for implicit digestive symptom cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-health-gastro-1',
      message: 'gonfiore e problemi digestivi',
      detectedDomain: 'health',
      allDomains: ['health'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('gastroenterologo')
  })

  it('picks a mindfulness specialist for implicit burnout and focus collapse', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-mindfulness-1',
      message: 'mi sento in burnout e non riesco a concentrarmi',
      detectedDomain: 'mindfulness',
      allDomains: ['mindfulness', 'inspiration'],
      team,
    })

    expect(out.caseState.ownerAgentId).toBe('psicologo')
  })

  it('picks a coordination specialist for broad overload instead of a weak inspiration fallback', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-coordination-1',
      message: 'non riesco più a gestire tutto',
      detectedDomain: 'coordination',
      allDomains: ['coordination', 'mindfulness'],
      team,
    })

    expect(['analista-contesto', 'life-organizer']).toContain(out.caseState.ownerAgentId)
  })

  it('avoids absurd implicit owners on practical separation cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-separation-practical-1',
      message: 'mi sto separando e ci sono problemi pratici',
      detectedDomain: 'inspiration',
      allDomains: ['inspiration', 'coordination'],
      team,
    })

    expect([
      'relationship-coach',
      'life-organizer',
      'analista-contesto',
      'consulente-legale',
    ]).toContain(out.caseState.ownerAgentId)
  })

  it('keeps a coherent health owner on training pain dirty cases', () => {
    const out = advanceCaseState({
      current: null,
      conversationId: 'implicit-health-training-pain-1',
      message: 'mi fa male il ginocchio quando corro',
      detectedDomain: 'health',
      allDomains: ['health', 'training'],
      team,
    })

    expect(['fisioterapista', 'medico-dello-sport', 'fisiatra']).toContain(
      out.caseState.ownerAgentId,
    )
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

  it('treats an implicit specialist-led owner as activeSpecialist when the domain is strong', () => {
    const current = advanceCaseState({
      current: null,
      conversationId: 'c5b',
      message: 'voglio una dieta',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    }).caseState

    const active = deriveActiveSpecialistFromCaseState(current, team)

    expect(current.ownerAgentId).toBe('dietista')
    expect(active).toMatchObject({ id: 'dietista' })
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
    expect(out.caseState.activeSpeakerAgentId).toBe('cardiologo')
    expect(out.events.map((e) => e.kind)).toEqual(['consult_requested', 'takeover_started'])
    expect(out.events[0]?.reason.toLowerCase()).toMatch(/toracic|tachic|pressione/)
  })

  it('keeps the consult target active on natural continuity phrases', () => {
    const consultState = {
      conversationId: 'c-takeover',
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
      conversationId: 'c-takeover',
      message: 'continuiamo con lui sul recupero del ginocchio',
      detectedDomain: 'training',
      allDomains: ['training'],
      team,
    })

    expect(out.caseState.protocolState).toBe('consult_active_takeover')
    expect(out.caseState.activeSpeakerAgentId).toBe('fisioterapista')
    expect(out.events.map((e) => e.kind)).toEqual(['takeover_continued'])
  })

  it('keeps same-domain takeover active on softer continuity phrasing', () => {
    const consultState = {
      conversationId: 'c-takeover-soft',
      ownerAgentId: 'chef',
      activeSpeakerAgentId: 'dietista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'dietista',
      returnTargetAgentId: 'chef',
      consultReason: 'Dieta clinica o vincoli nutrizionali -> dietista del team',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const softPhrases = [
      'restiamo su questa parte',
      'proseguiamo con lui',
      'parliamo ancora di questo con lui',
    ]

    for (const phrase of softPhrases) {
      const out = advanceCaseState({
        current: consultState,
        conversationId: 'c-takeover-soft',
        message: phrase,
        detectedDomain: 'nutrition',
        allDomains: ['nutrition'],
        team,
      })

      expect(out.caseState.protocolState).toBe('consult_active_takeover')
      expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
      expect(out.events.map((e) => e.kind)).toEqual(['takeover_continued'])
    }
  })

  it('opens an implicit handoff checkpoint on natural continuity without explicit handoff wording', () => {
    const consultState = {
      conversationId: 'c-handoff-implicit',
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
      conversationId: 'c-handoff-implicit',
      message: 'vorrei che fosse lui a seguirmi su questa parte e continuiamo con il recupero',
      detectedDomain: 'training',
      allDomains: ['training', 'health'],
      team,
    })

    expect(out.caseState.protocolState).toBe('handoff_pending_user')
    expect(out.caseState.pendingHandoffAgentId).toBe('fisioterapista')
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_requested'])
  })

  it('opens an implicit handoff for same-domain legal continuity when the consultato is clearly taking over', () => {
    const consultState = {
      conversationId: 'c-handoff-legal',
      ownerAgentId: 'relationship-coach',
      activeSpeakerAgentId: 'consulente-legale',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'consulente-legale',
      returnTargetAgentId: 'relationship-coach',
      consultReason:
        'Separazione complessa o conflitti con implicazioni legali -> consulente legale del team',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c-handoff-legal',
      message: 'vorrei proseguire con lui sugli accordi legali e restiamo su questo percorso',
      detectedDomain: 'inspiration',
      allDomains: ['inspiration'],
      team,
    })

    expect(out.caseState.protocolState).toBe('handoff_pending_user')
    expect(out.caseState.pendingHandoffAgentId).toBe('consulente-legale')
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_requested'])
  })

  it('opens a same-domain handoff from chef to dietista on natural continuity phrasing', () => {
    const consultState = {
      conversationId: 'c-handoff-nutrition',
      ownerAgentId: 'chef',
      activeSpeakerAgentId: 'dietista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'dietista',
      returnTargetAgentId: 'chef',
      consultReason: 'Dieta clinica o vincoli nutrizionali -> dietista del team',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c-handoff-nutrition',
      message: 'restiamo su questa parte e andiamo avanti con questo percorso',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    })

    expect(out.caseState.protocolState).toBe('handoff_pending_user')
    expect(out.caseState.pendingHandoffAgentId).toBe('dietista')
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_requested'])
  })

  it('opens a same-domain handoff on stronger ownership phrasing with "da ora"', () => {
    const consultState = {
      conversationId: 'c-handoff-strong-now',
      ownerAgentId: 'chef',
      activeSpeakerAgentId: 'dietista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'dietista',
      returnTargetAgentId: 'chef',
      consultReason: 'Dieta clinica o vincoli nutrizionali -> dietista del team',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c-handoff-strong-now',
      message: 'vorrei che fosse lui a seguirmi da ora',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    })

    expect(out.caseState.protocolState).toBe('handoff_pending_user')
    expect(out.caseState.pendingHandoffAgentId).toBe('dietista')
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_requested'])
  })

  it('opens a same-domain handoff on equivalent stable ownership phrasing', () => {
    const consultState = {
      conversationId: 'c-handoff-strong-stable',
      ownerAgentId: 'chef',
      activeSpeakerAgentId: 'dietista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'dietista',
      returnTargetAgentId: 'chef',
      consultReason: 'Dieta clinica o vincoli nutrizionali -> dietista del team',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const out = advanceCaseState({
      current: consultState,
      conversationId: 'c-handoff-strong-stable',
      message: 'vorrei continuare con lui come riferimento principale',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team,
    })

    expect(out.caseState.protocolState).toBe('handoff_pending_user')
    expect(out.caseState.pendingHandoffAgentId).toBe('dietista')
    expect(out.events.map((e) => e.kind)).toEqual(['handoff_requested'])
  })

  it('does not open an implicit handoff on a vague follow-up that does not justify ownership transfer', () => {
    const consultState = {
      conversationId: 'c-handoff-no',
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
      conversationId: 'c-handoff-no',
      message: 'ok capito',
      detectedDomain: 'training',
      allDomains: ['training'],
      team,
    })

    expect(out.caseState.protocolState).toBe('owner_active')
    expect(out.caseState.activeSpeakerAgentId).toBe('dietista')
    expect(out.events.map((e) => e.kind)).toEqual(['return_baton'])
  })

  it('does not open same-domain handoff on short acknowledgements', () => {
    const consultState = {
      conversationId: 'c-handoff-short',
      ownerAgentId: 'chef',
      activeSpeakerAgentId: 'dietista',
      protocolState: 'consult_active_takeover' as const,
      consultTargetAgentId: 'dietista',
      returnTargetAgentId: 'chef',
      consultReason: 'Dieta clinica o vincoli nutrizionali -> dietista del team',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    for (const phrase of ['ok', 'grazie', 'capito']) {
      const out = advanceCaseState({
        current: consultState,
        conversationId: 'c-handoff-short',
        message: phrase,
        detectedDomain: 'nutrition',
        allDomains: ['nutrition'],
        team,
      })

      expect(out.caseState.protocolState).toBe('owner_active')
      expect(out.caseState.activeSpeakerAgentId).toBe('chef')
      expect(out.events.map((e) => e.kind)).toEqual(['return_baton'])
    }
  })
})
