import { describe, expect, it } from 'vitest'
import { buildAgentUserPrompt, formatUserAttributes } from '@/lib/ai/orchestrator/agentPrompt'
import type { AgentInput } from '@/lib/ai/types'

const input: AgentInput = {
  requestId: 'r1',
  userId: 'u1',
  conversationId: 'c1',
  message: 'Peso 82 kg e voglio migliorare la dieta.',
  contextPack: {
    user: {
      id: 'u1',
      role: 'USER',
      profile: {
        birthDate: '1991-06-26',
        height: 180,
      },
      attributes: {
        personal: {
          birthDate: { value: '1991-06-26', recordedAt: new Date().toISOString() },
        },
        nutrition: {
          allergy: { value: 'glutine', recordedAt: new Date().toISOString() },
          weight: { value: 82, unit: 'kg', recordedAt: new Date().toISOString() },
        },
      },
    },
    history: {
      recentMessages: [
        {
          role: 'assistant',
          content: 'Hai allergie o intolleranze alimentari da registrare?',
          createdAt: new Date().toISOString(),
        },
        { role: 'user', content: 'Si, glutine.', createdAt: new Date().toISOString() },
        {
          role: 'assistant',
          content:
            'Hai allergie o intolleranze alimentari da registrare?\nQual è il tuo obiettivo nutrizionale principale nelle prossime settimane?\nNota non interrogativa.',
          createdAt: new Date().toISOString(),
        },
      ],
      agentWorkspaces: [
        {
          agentId: 'dietista',
          round2Summary: 'Hai già condiviso allergie e peso.',
          updatedAt: new Date().toISOString(),
        },
      ],
      recentArtifacts: [],
    },
    trackers: {},
    notifications: { unreadCount: 0 },
    ui: { moodScore: 55, sectionScores: { general: 50, nutrition: 60 } },
  },
}

describe('orchestrator agent prompt builder', () => {
  it('formats user attributes in stable domain buckets', () => {
    expect(formatUserAttributes(input)).toEqual([
      '[personal] birthDate: 1991-06-26',
      '[nutrition] allergy: glutine | weight: 82 kg',
    ])
  })

  it('includes stable prompt sections and markers', () => {
    const prompt = buildAgentUserPrompt(input, 'dietista')

    expect(prompt).toContain('USER MESSAGE:')
    expect(prompt).toContain('CONTEXT (summary):')
    expect(prompt).toContain('- role: USER')
    expect(prompt).toContain('- moodScore: 55')
    expect(prompt).toContain('- userProfile: birthDate: "1991-06-26", height: 180')
    expect(prompt).toContain('USER ATTRIBUTES (fonte principale dinamica):')
    expect(prompt).toContain('[nutrition] allergy: glutine | weight: 82 kg')
    expect(prompt).toContain('WORKSPACE MEMORIA TURNO PRECEDENTE:')
    expect(prompt).toContain('Hai già condiviso allergie e peso.')
    expect(prompt).toContain('PROFILE EXTRACTION (MANDATORY):')
    expect(prompt).toContain('NATURAL DIALOGUE RULE:')
    expect(prompt).toContain('OUTPUT JSON SCHEMA (rispetta esattamente questa struttura):')
  })

  it('preserves previous team questions guidance and peer review sections', () => {
    const prompt = buildAgentUserPrompt(
      input,
      'dietista',
      '- fisioterapista: valuta anche il carico di allenamento',
    )

    expect(prompt).toContain('PREVIOUS TEAM QUESTIONS (from last turn):')
    expect(prompt).toContain('- Hai allergie o intolleranze alimentari da registrare?')
    expect(prompt).toContain(
      '- Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?',
    )
    expect(prompt).toContain(
      'If the user message answers any of these questions, include a "user.setAttribute" tool call',
    )
    expect(prompt).toContain('PEER REVIEW (round 2):')
    expect(prompt).toContain('- fisioterapista: valuta anche il carico di allenamento')
    expect(prompt).toContain(
      'Integra o correggi la tua proposta alla luce dei contributi dei colleghi.',
    )
  })
})
