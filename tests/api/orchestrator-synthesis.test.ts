import { describe, expect, it, vi } from 'vitest'
import { buildProfessionalOutputInstructions } from '@/lib/ai/artifacts/contracts'
import { synthesizeRawResponse } from '@/lib/ai/orchestrator/synthesis'
import type { AgentProposal, ContextPack } from '@/lib/ai/types'

const contextPack: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: {
    recentMessages: [
      { role: 'user', content: 'ciao', createdAt: '2026-03-13T10:00:00.000Z' },
      { role: 'assistant', content: 'dimmi pure', createdAt: '2026-03-13T10:00:10.000Z' },
    ],
    recentArtifacts: [],
  },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

const proposals: AgentProposal[] = [
  {
    agentId: 'dietista',
    domain: 'nutrition',
    summary: 'Prima summary',
    reasoning: 'ok',
    questions: [],
    recommendations: [
      {
        title: 'Azione 1',
        steps: ['step a', 'step b', 'step c'],
        rationale: 'ok',
      },
    ],
    toolCalls: [],
    confidence: 0.7,
  },
  {
    agentId: 'gastroenterologo',
    domain: 'health',
    summary: 'Seconda summary',
    reasoning: 'ok',
    questions: [],
    recommendations: [
      {
        title: 'Azione 2',
        steps: ['step x', 'step y'],
        rationale: 'ok',
      },
    ],
    toolCalls: [],
    confidence: 0.9,
  },
]

describe('synthesis boundary', () => {
  it('returns raw text from llm and builds expected prompt markers', async () => {
    const complete = vi.fn().mockResolvedValue({ text: 'Risposta finale.' })

    const result = await synthesizeRawResponse({
      llm: { complete },
      userMessage: 'voglio un piano alimentare',
      proposals,
      gatingQuestions: ['Hai allergie?'],
      criticalQuestions: ['Hai allergie?'],
      contextPack,
    })

    expect(result).toEqual({ rawText: 'Risposta finale.', fallbackUsed: false })
    expect(complete).toHaveBeenCalledTimes(1)
    const call = complete.mock.calls[0]?.[0]
    expect(call?.format).toBe('text')
    expect(call?.system).toContain('team LiveWell')
    expect(call?.user).toContain('CONVERSAZIONE RECENTE:')
    expect(call?.user).toContain('ANALISI DEL TEAM SPECIALISTICO:')
    expect(call?.system).not.toContain('SPECIALISTI ATTIVI IN QUESTA CONVERSAZIONE')
    // recommendations and missing data labels updated in new prompt design
    expect(call?.user).toContain('Hai allergie?')
    expect(call?.user.indexOf('Seconda summary')).toBeLessThan(call?.user.indexOf('Prima summary'))
  })

  it('does not ask for a definitive plan when critical data are still missing', async () => {
    const complete = vi.fn().mockResolvedValue({ text: 'Serve prima qualche dato in piu.' })

    await synthesizeRawResponse({
      llm: { complete },
      userMessage: 'voglio una dieta completa',
      proposals,
      gatingQuestions: ['Hai allergie o intolleranze?'],
      criticalQuestions: ['Hai allergie o intolleranze?'],
      contextPack,
      activeSpecialist: {
        id: 'dietista',
        displayName: 'Dietista',
        domain: 'nutrition',
        domains: ['nutrition'],
        runtimeCapabilities: {
          canDo: [],
          cannotDo: [],
          consultTriggers: [],
          handoffTriggers: [],
          minimumInput: ['Allergie', 'Obiettivo'],
          outputContracts: [],
          escalationRules: [],
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
    })

    const call = complete.mock.calls[0]?.[0]
    expect(call?.system).toContain('NON produrre un piano definitivo')
    expect(call?.user).toContain('NON produrre un documento definitivo')
    expect(call?.user).not.toContain('NON chiedere altre informazioni')
  })

  it('aligns professional output instructions with the prudent missing-data gate', () => {
    const instructions = buildProfessionalOutputInstructions({
      id: 'dietista',
      displayName: 'Dietista',
      domainTags: ['nutrition'],
      systemPrompt: 'x',
      toolsAllowed: [],
      decisionStyle: 'team-led',
      runtimeCapabilities: {
        canDo: [],
        cannotDo: [],
        consultTriggers: [],
        handoffTriggers: [],
        minimumInput: ['Allergie', 'Obiettivo'],
        outputContracts: [],
        escalationRules: [],
        allowedTools: [],
        artifacts: [
          {
            kind: 'meal-plan',
            storageType: 'nutrition',
            description: 'Piano nutrizionale strutturato',
          },
        ],
      },
    })

    expect(instructions).toContain('Se mancano dati essenziali')
    expect(instructions).toContain('struttura preliminare chiaramente incompleta')
    expect(instructions).not.toContain('assumi valori ragionevoli')
  })

  it('applies the prudent gate to structured requests beyond classic piano/protocollo wording', async () => {
    const complete = vi.fn().mockResolvedValue({ text: 'Serve prima qualche dato in piu.' })

    await synthesizeRawResponse({
      llm: { complete },
      userMessage: 'fammi una scheda completa e una valutazione dettagliata',
      proposals,
      gatingQuestions: ['Hai infortuni o limitazioni attive?'],
      criticalQuestions: ['Hai infortuni o limitazioni attive?'],
      contextPack,
      activeSpecialist: {
        id: 'persona-trainer',
        displayName: 'Persona Trainer',
        domain: 'training',
        domains: ['training'],
        runtimeCapabilities: {
          canDo: [],
          cannotDo: [],
          consultTriggers: [],
          handoffTriggers: [],
          minimumInput: ['Infortuni', 'Goal'],
          outputContracts: [],
          escalationRules: [],
          allowedTools: [],
          artifacts: [
            {
              kind: 'training-plan',
              storageType: 'training',
              description: 'Scheda allenamento strutturata',
            },
          ],
        },
      },
    })

    const call = complete.mock.calls[0]?.[0]
    expect(call?.system).toContain('NON produrre un piano definitivo')
    expect(call?.user).toContain('NON produrre un documento definitivo')
  })

  it('falls back to the first available proposal summary when model returns json-like text', async () => {
    const result = await synthesizeRawResponse({
      llm: {
        complete: vi.fn().mockResolvedValue({ text: '{"summary":"json"}' }),
      },
      userMessage: 'voglio un piano alimentare',
      proposals,
      gatingQuestions: [],
      criticalQuestions: [],
      contextPack,
    })

    expect(result).toEqual({ rawText: 'Prima summary', fallbackUsed: true })
  })

  it('falls back to default message when llm fails and no proposal summary exists', async () => {
    const result = await synthesizeRawResponse({
      llm: {
        complete: vi.fn().mockRejectedValue(new Error('boom')),
      },
      userMessage: 'ciao',
      proposals: [
        {
          agentId: 'a1',
          domain: 'general',
          summary: '',
          reasoning: 'ok',
          questions: [],
          recommendations: [],
          toolCalls: [],
          confidence: 0.2,
        },
      ],
      gatingQuestions: [],
      criticalQuestions: [],
      contextPack,
      activeSpecialist: {
        id: 'dietista',
        displayName: 'Dietista',
        domain: 'nutrition',
      },
    })

    expect(result).toEqual({ rawText: 'Come posso aiutarti?', fallbackUsed: true })
  })
})
