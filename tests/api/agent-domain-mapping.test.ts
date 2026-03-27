import { describe, expect, it } from 'vitest'
import { deriveActiveSpecialistFromCaseState } from '@/lib/ai/case/compat'
import { enforceDomainIsolation } from '@/lib/ai/consensus/domainResolver'
import { buildThinkingEvents } from '@/app/api/chat/send/chatStream'
import { getAgentPrimaryDomain, resolveAgentRuntimeDomain } from '@/lib/ai/team/domainMapping'
import type { AgentProfile, Domain } from '@/lib/ai/types'

function makeAgent(
  id: string,
  displayName: string,
  domainTags: Domain[],
  primaryDomain?: Domain,
): AgentProfile {
  return {
    id,
    displayName,
    domainTags,
    primaryDomain,
    systemPrompt: `Sei ${displayName}.`,
    toolsAllowed: ['user.setAttribute'],
    decisionStyle: 'team-led',
  }
}

describe('agent/domain canonical mapping', () => {
  const sleepCoach = makeAgent(
    'sleep-coach',
    'Sleep Coach',
    ['health', 'mindfulness'],
    'mindfulness',
  )

  it('usa il dominio runtime attivo quando uno specialista multi-dominio lo supporta davvero', () => {
    expect(
      resolveAgentRuntimeDomain(sleepCoach, {
        preferredDomain: 'health',
      }),
    ).toBe('health')
  })

  it('usa il primaryDomain canonico quando non esiste un hint runtime affidabile', () => {
    expect(getAgentPrimaryDomain(sleepCoach)).toBe('mindfulness')
    expect(resolveAgentRuntimeDomain(sleepCoach)).toBe('mindfulness')
  })

  it('non normalizza una proposta valida al dominio sbagliato solo per l’ordine dei tag', () => {
    const { normalized, violations } = enforceDomainIsolation(
      [
        {
          agentId: 'sleep-coach',
          domain: 'health',
          summary: 'Valuto il sonno come fattore secondario del quadro clinico',
          reasoning: 'Il dominio health qui è esplicito e coerente col caso.',
        },
      ],
      [sleepCoach],
    )

    expect(violations).toEqual([])
    expect(normalized[0]?.domain).toBe('health')
  })

  it('deriva lo specialista attivo dal lead panel canonico invece che dal primo tag dominio', () => {
    const active = deriveActiveSpecialistFromCaseState(
      {
        conversationId: 'conv-1',
        ownerAgentId: 'sleep-coach',
        activeSpeakerAgentId: 'sleep-coach',
        protocolState: 'consult_active_takeover',
        leadDomain: 'health',
        activeDomains: ['health', 'mindfulness'],
        domainPanels: [
          {
            domain: 'health',
            selectedAgentId: 'sleep-coach',
            candidateAgentIds: ['sleep-coach'],
            status: 'active',
            priorityScore: 9,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
          {
            domain: 'mindfulness',
            selectedAgentId: 'sleep-coach',
            candidateAgentIds: ['sleep-coach'],
            status: 'monitoring',
            priorityScore: 6,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
        updatedAt: '2026-03-28T00:10:00.000Z',
      } as never,
      [sleepCoach],
    )

    expect(active).toMatchObject({
      id: 'sleep-coach',
      domain: 'health',
      domains: ['health', 'mindfulness'],
    })
  })

  it('usa il mapping canonico anche nei thinking events fallback production-facing', () => {
    const events = buildThinkingEvents(
      {
        debug: {
          selectedAgents: ['sleep-coach'],
        },
      },
      [sleepCoach],
    )

    expect(events).toEqual([
      expect.objectContaining({
        specialistName: 'Sleep Coach',
        domain: 'mindfulness',
      }),
    ])
  })
})
