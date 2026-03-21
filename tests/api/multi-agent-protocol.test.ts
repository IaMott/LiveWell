/**
 * multi-agent-protocol.test.ts
 *
 * Test mirati sul PROTOCOLLO CASE (state machine) del sistema multi-agente.
 * Copre: inizializzazione, consult, takeover, return_baton, handoff,
 * loop guard, max takeover turns, getCaseRoutingDomain.
 */

import { describe, expect, it } from 'vitest'
import type { AgentProfile } from '@/lib/ai/types'
import type { CaseState } from '@/lib/ai/case/state'
import {
  advanceCaseState,
  detectRequestedAgentId,
  getCaseRoutingDomain,
} from '@/lib/ai/case/protocol'
import { deriveActiveSpecialistFromCaseState } from '@/lib/ai/case/compat'

// ─── Team fixture ─────────────────────────────────────────────────────────────

/**
 * Fixture base SENZA runtimeCapabilities: permette di testare la state machine
 * isolata dalla logica capability-based (consult/handoff automatici).
 * I test capability-based sono in un describe separato sotto.
 */
function agent(id: string, displayName: string, tags: AgentProfile['domainTags']): AgentProfile {
  return {
    id,
    displayName,
    domainTags: tags,
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  }
}

// Team base senza capabilities (per test state machine puri)
const TEAM: AgentProfile[] = [
  agent('dietista', 'Dietista', ['nutrition']),
  agent('fisioterapista', 'Fisioterapista', ['health', 'training']),
  agent('psicologo', 'Psicologo', ['mindfulness']),
  agent('mmg', 'Medico di Base', ['health']),
  agent('sleep-coach', 'Coach del Sonno', ['mindfulness', 'health']),
  agent('persona-trainer', 'Personal Trainer', ['training']),
  agent('orchestratore', 'Orchestratore', ['general', 'coordination']),
]

const CONV_ID = 'conv-test-001'

// ─── Helper: costruisce CaseState ─────────────────────────────────────────────

function makeState(overrides: Partial<CaseState>): CaseState {
  return {
    conversationId: CONV_ID,
    ownerAgentId: 'dietista',
    activeSpeakerAgentId: 'dietista',
    protocolState: 'owner_active',
    takeoverTurns: 0,
    loopCount: 0,
    handoffCount: 0,
    ...overrides,
  }
}

// ─── 1. Inizializzazione (null → owner_active) ────────────────────────────────

describe('advanceCaseState — inizializzazione', () => {
  it('da null: crea owner_active con dominio rilevato', () => {
    const { caseState, events } = advanceCaseState({
      current: null,
      conversationId: CONV_ID,
      message: 'voglio un piano alimentare',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team: TEAM,
    })
    expect(caseState.protocolState).toBe('owner_active')
    expect(caseState.ownerAgentId).toBe('dietista')
    expect(caseState.activeSpeakerAgentId).toBe('dietista')
    expect(events[0]?.kind).toBe('initialized')
  })

  it('da null con richiesta esplicita: owner è lo specialista richiesto', () => {
    const { caseState } = advanceCaseState({
      current: null,
      conversationId: CONV_ID,
      message: 'voglio parlare con il fisioterapista',
      detectedDomain: 'health',
      allDomains: ['health'],
      team: TEAM,
    })
    expect(caseState.ownerAgentId).toBe('fisioterapista')
    expect(caseState.activeSpeakerAgentId).toBe('fisioterapista')
  })

  it('da null con dominio general: owner è orchestratore', () => {
    const { caseState } = advanceCaseState({
      current: null,
      conversationId: CONV_ID,
      message: 'ciao come funziona?',
      detectedDomain: 'general',
      allDomains: ['general'],
      team: TEAM,
    })
    // orchestratore ha domainTag 'general'/'coordination'
    expect(['orchestratore', 'analista-contesto'].includes(caseState.ownerAgentId)).toBe(true)
  })
})

// ─── 2. owner_active → consult_active_takeover ───────────────────────────────

describe('advanceCaseState — transizione a consult_active_takeover', () => {
  it('owner_active + richiesta esplicita → consult_active_takeover', () => {
    const current = makeState({ ownerAgentId: 'dietista', activeSpeakerAgentId: 'dietista' })

    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'passami il fisioterapista',
      detectedDomain: 'health',
      allDomains: ['health'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('consult_active_takeover')
    expect(caseState.activeSpeakerAgentId).toBe('fisioterapista')
    expect(caseState.ownerAgentId).toBe('dietista') // owner non cambia
    expect(caseState.consultTargetAgentId).toBe('fisioterapista')
    expect(caseState.returnTargetAgentId).toBe('dietista')
    expect(events.some((e) => e.kind === 'consult_requested')).toBe(true)
    expect(events.some((e) => e.kind === 'takeover_started')).toBe(true)
  })

  it('loopCount incrementato ad ogni consult', () => {
    const current = makeState({ loopCount: 1 })
    const { caseState } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'voglio parlare con il fisioterapista',
      detectedDomain: 'health',
      allDomains: ['health'],
      team: TEAM,
    })
    expect(caseState.loopCount).toBe(2)
  })
})

// ─── 3. consult_active_takeover → return_baton ───────────────────────────────

describe('advanceCaseState — return_baton da takeover', () => {
  it('"torna al team" → return_baton + owner_active', () => {
    const current = makeState({
      protocolState: 'consult_active_takeover',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      takeoverTurns: 1,
      loopCount: 1,
    })

    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'torna al team',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('owner_active')
    expect(caseState.activeSpeakerAgentId).toBe('dietista')
    expect(events.some((e) => e.kind === 'return_baton')).toBe(true)
  })

  it('MAX_TAKEOVER_TURNS superato → return_baton automatico (su filler neutro)', () => {
    const current = makeState({
      protocolState: 'consult_active_takeover',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      takeoverTurns: 2, // = MAX_TAKEOVER_TURNS
      loopCount: 1,
    })

    // Messaggio filler: non trigger né handoff né continuazione →
    // la state machine deve usare il guard MAX_TAKEOVER_TURNS → return_baton
    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'ok grazie',
      detectedDomain: 'health',
      allDomains: ['health'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('owner_active')
    expect(events.some((e) => e.kind === 'return_baton')).toBe(true)
  })
})

// ─── 4. consult_active_takeover → takeover_continued ─────────────────────────

describe('advanceCaseState — takeover_continued', () => {
  it('continuazione naturale tramite focus signal → takeover_continued + takeoverTurns++', () => {
    // Usiamo sleep-coach: ha hasConsultFocusSignal per parola "sonno" →
    // shouldKeepConsultTargetActive → true (senza dipendere da capability handoff)
    const current = makeState({
      protocolState: 'consult_active_takeover',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'sleep-coach',
      consultTargetAgentId: 'sleep-coach',
      returnTargetAgentId: 'dietista',
      takeoverTurns: 1,
      loopCount: 1,
    })

    // "sonno" → hasConsultFocusSignal('sleep-coach', ...) = true
    // → shouldKeepConsultTargetActive = true → takeover_continued
    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'parliamo ancora di sonno e insonnia',
      detectedDomain: 'mindfulness',
      allDomains: ['mindfulness'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('consult_active_takeover')
    expect(caseState.activeSpeakerAgentId).toBe('sleep-coach')
    expect(caseState.takeoverTurns).toBe(2)
    expect(events.some((e) => e.kind === 'takeover_continued')).toBe(true)
  })
})

// ─── 5. handoff lifecycle ─────────────────────────────────────────────────────

describe('advanceCaseState — handoff lifecycle', () => {
  it('handoff_pending_user + continuazione → handoff_completed', () => {
    const current = makeState({
      protocolState: 'handoff_pending_user',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      pendingHandoffAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    })

    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'sì, vorrei che fosse il fisioterapista a seguirmi',
      detectedDomain: 'health',
      allDomains: ['health'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('owner_active')
    expect(caseState.ownerAgentId).toBe('fisioterapista')
    expect(caseState.handoffCount).toBe(1)
    expect(events.some((e) => e.kind === 'handoff_completed')).toBe(true)
  })

  it('handoff_pending_user + "torna al team" → handoff annullato', () => {
    const current = makeState({
      protocolState: 'handoff_pending_user',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      pendingHandoffAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    })

    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'torna al team',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('owner_active')
    expect(caseState.ownerAgentId).toBe('dietista')
    expect(events.some((e) => e.kind === 'return_baton')).toBe(true)
  })
})

// ─── 6. Loop guard (MAX_CONSULT_LOOPS = 3) ───────────────────────────────────

describe('advanceCaseState — loop guard', () => {
  it('loopCount >= 3 → consult_blocked, stato invariato', () => {
    const current = makeState({
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'dietista',
      loopCount: 3, // = MAX_CONSULT_LOOPS
    })

    const { caseState, events } = advanceCaseState({
      current,
      conversationId: CONV_ID,
      message: 'voglio parlare con il psicologo',
      detectedDomain: 'mindfulness',
      allDomains: ['mindfulness'],
      team: TEAM,
    })

    expect(caseState.protocolState).toBe('owner_active') // non cambia
    expect(events.some((e) => e.kind === 'consult_blocked')).toBe(true)
  })
})

// ─── 7. detectRequestedAgentId ───────────────────────────────────────────────

describe('detectRequestedAgentId', () => {
  it('rileva "voglio parlare con il fisioterapista"', () => {
    const id = detectRequestedAgentId('voglio parlare con il fisioterapista', TEAM)
    expect(id).toBe('fisioterapista')
  })

  it('rileva "passami la dietista"', () => {
    const id = detectRequestedAgentId('passami la dietista', TEAM)
    expect(id).toBe('dietista')
  })

  it('rileva per displayName con "parlare con"', () => {
    const id = detectRequestedAgentId('voglio parlare con il Medico di Base', TEAM)
    expect(id).toBe('mmg')
  })

  it('ritorna null senza verbo di richiesta', () => {
    const id = detectRequestedAgentId('ho parlato con il fisioterapista ieri', TEAM)
    // "parlato con" non è nel REQUEST_VERBS — deve ritornare null
    expect(id).toBeNull()
  })

  it('ritorna null per messaggio senza agente menzionato', () => {
    const id = detectRequestedAgentId('ho dolore alla schiena', TEAM)
    expect(id).toBeNull()
  })
})

// ─── 8. getCaseRoutingDomain ──────────────────────────────────────────────────

describe('getCaseRoutingDomain', () => {
  it('senza caseState → usa fallbackDomain', () => {
    const domain = getCaseRoutingDomain(null, TEAM, 'nutrition')
    expect(domain).toBe('nutrition')
  })

  it('owner nutrition, fallback nutrition → nutrition', () => {
    const state = makeState({ ownerAgentId: 'dietista', activeSpeakerAgentId: 'dietista' })
    const domain = getCaseRoutingDomain(state, TEAM, 'nutrition')
    expect(domain).toBe('nutrition')
  })

  it('owner health, fallback general → restituisce tag dominio del speaker', () => {
    const state = makeState({
      ownerAgentId: 'fisioterapista',
      activeSpeakerAgentId: 'fisioterapista',
    })
    const domain = getCaseRoutingDomain(state, TEAM, 'general')
    // fisioterapista ha ['health', 'training'] → preferisce il primo non-general
    expect(['health', 'training'].includes(domain)).toBe(true)
  })

  it('owner orchestratore con tag coordination, fallback general → general', () => {
    const state = makeState({
      ownerAgentId: 'orchestratore',
      activeSpeakerAgentId: 'orchestratore',
    })
    const domain = getCaseRoutingDomain(state, TEAM, 'general')
    expect(domain).toBe('general')
  })
})

// ─── 9. deriveActiveSpecialistFromCaseState ───────────────────────────────────

describe('deriveActiveSpecialistFromCaseState', () => {
  it('owner_active → restituisce lo speaker attivo', () => {
    const state = makeState({ ownerAgentId: 'dietista', activeSpeakerAgentId: 'dietista' })
    const specialist = deriveActiveSpecialistFromCaseState(state, TEAM)
    expect(specialist?.id).toBe('dietista')
  })

  it('consult_active_takeover → restituisce il consulente attivo', () => {
    const state = makeState({
      protocolState: 'consult_active_takeover',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
    })
    const specialist = deriveActiveSpecialistFromCaseState(state, TEAM)
    expect(specialist?.id).toBe('fisioterapista')
  })

  it('speaker non trovato nel team → null', () => {
    const state = makeState({ activeSpeakerAgentId: 'agente-inesistente' })
    const specialist = deriveActiveSpecialistFromCaseState(state, TEAM)
    expect(specialist).toBeUndefined()
  })
})

// ─── 10. Scenario completo: 3 turn con passaggio e ritorno ────────────────────

describe('Scenario completo: dietista → fisioterapista → ritorno dietista', () => {
  it('simula 3 turni: init → consult → return_baton', () => {
    // Turn 1: inizializzazione con dietista
    const t1 = advanceCaseState({
      current: null,
      conversationId: CONV_ID,
      message: 'voglio migliorare la mia dieta',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team: TEAM,
    })
    expect(t1.caseState.ownerAgentId).toBe('dietista')
    expect(t1.caseState.protocolState).toBe('owner_active')

    // Turn 2: richiesta fisioterapista
    const t2 = advanceCaseState({
      current: t1.caseState,
      conversationId: CONV_ID,
      message: 'voglio parlare con il fisioterapista per il dolore al ginocchio',
      detectedDomain: 'health',
      allDomains: ['health'],
      team: TEAM,
    })
    expect(t2.caseState.protocolState).toBe('consult_active_takeover')
    expect(t2.caseState.activeSpeakerAgentId).toBe('fisioterapista')
    expect(t2.caseState.ownerAgentId).toBe('dietista') // owner invariato

    // Turn 3: ritorno al team
    const t3 = advanceCaseState({
      current: t2.caseState,
      conversationId: CONV_ID,
      message: 'torna al team, grazie',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
      team: TEAM,
    })
    expect(t3.caseState.protocolState).toBe('owner_active')
    expect(t3.caseState.activeSpeakerAgentId).toBe('dietista')
    expect(t3.events.some((e) => e.kind === 'return_baton')).toBe(true)
  })
})
