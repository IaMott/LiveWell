import { describe, it, expect } from 'vitest'
import { routeMessage } from '../src/lib/ai/orchestrator'
import type { ConversationContext } from '../src/lib/ai/types'

function mockContext(partial?: Partial<ConversationContext>): ConversationContext {
  return {
    messages: [{ role: 'user', content: 'test' }],
    domain: 'allenamento',
    knownData: {},
    missingData: [],
    requiredData: [],
    specialistMemory: {},
    riskSignal: 'none',
    userId: 'u1',
    profileData: undefined,
    ...partial,
  }
}

describe('orchestrator routing', () => {
  it('forza MMG su richiesta esplicita medico', () => {
    const routing = routeMessage('voglio parlare con un medico', mockContext())
    expect(routing.primarySpecialist).toBe('mmg')
  })

  it('non usa analista_contesto come primario su dominio generale', () => {
    const routing = routeMessage(
      'ciao',
      mockContext({ domain: 'generale', missingData: ['obiettivo'] }),
    )
    expect(routing.primarySpecialist).toBe('intervistatore')
    expect(routing.primarySpecialist).not.toBe('analista_contesto')
  })

  it('attiva co-routing dietista+pt su contesto dimagrimento con allenamento', () => {
    const routing = routeMessage(
      'cosa proponete?',
      mockContext({
        domain: 'nutrizione',
        knownData: {
          obiettivo: 'dimagrire',
          attività_fisica_attuale: 'palestra 3 volte',
          routine_pasti: '3 pasti',
        },
      }),
    )
    expect(routing.primarySpecialist).toBe('dietista')
    expect(routing.supportSpecialists).toContain('personal_trainer')
  })
})
