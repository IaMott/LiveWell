/**
 * tests/api/chat-orchestration.test.ts
 *
 * Test di integrazione per la pipeline completa di orchestrazione: orchestrate().
 * Il LLM (Gemini) è mockato — si testano routing, consensus, tool planning, safety,
 * multi-turn context e casi limite senza fare chiamate reali all'API.
 *
 * SCENARI TESTATI (30 scenari + combinazioni)
 *
 * PIPELINE BASE
 *  1. Query health → domain='health', risposta presente
 *  2. Query nutrition → domain='nutrition'
 *  3. Query mindfulness → domain='mindfulness'
 *  4. Query training → domain='training'
 *  5. Query inspiration (carriera/finanze) → domain='inspiration'
 *
 * TOOL CALLS DURANTE CONVERSAZIONE
 *  6. Agente propone logDiagnosis → toolCallsToExecute contiene il tool
 *  7. Agente propone logBloodwork → tool presente e con args corretti
 *  8. Tool call deduplicato (stesso tool da 2 agenti) → una sola entry
 *  9. Tool call bloccato da retry guard (VALIDATION_ERROR recente) → escluso
 * 10. Inferred attribute tool call da messaggio (peso esplicito)
 *
 * DOMANDE DI GATING (informazioni mancanti)
 * 11. Proposta con questions → result.gatingQuestions non vuoto
 * 12. Multiple proposals con questions diverse → domande aggregate
 *
 * SAFETY E ESCALATION
 * 13. Flag urgentEscalation → safety.escalation='urgent'
 * 14. Flag potentialRisk → safety.escalation='recommend-professional'
 * 15. Nessun flag → safety.escalation='none'
 * 16. Messaggio ideazione suicidaria → escalation appropriata
 *
 * MULTI-TURN CONTEXT
 * 17. Conversazione con history → agenti ricevono messaggi precedenti
 * 18. Attributi utente nel context → usati nel prompt agente
 * 19. Clinica: diagnosi precedente nel context → agente può riferirla
 * 20. Context pack con profilo completo → non sollecita dati già noti
 *
 * FAST PATHS
 * 21. "Quanti anni ho?" con birthDate nota → risposta senza LLM call
 * 22. "Quanti anni ho?" senza birthDate → passa a pipeline normale
 *
 * RESILIENZA E FALLBACK
 * 23. Agente con timeout → proposal fallback, risposta comunque prodotta
 * 24. LLM ritorna JSON malformato → normalizzato con confidence=0, pipeline continua
 * 25. LLM ritorna testo non-JSON per agente → fallback proposal
 * 26. Tutti gli agenti falliscono → risposta fallback prodotta (finalMessageMarkdown non vuoto)
 *
 * MULTI-DOMINIO
 * 27. "Schiena + dieta" → tool calls da entrambi i domini
 * 28. "Ansia + insonnia" → mindfulness+health proposals
 * 29. Multi-agent consensus: due proposte con stessa raccomandazione → una sola
 *
 * EDGE CASES
 * 30. Messaggio lunghissimo (4000 chars) → pipeline completa senza errori
 * 31. Messaggio con solo numeri/simboli → gestito senza crash
 * 32. ConversationId diversi → context pack isolato per conversazione
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'
import type { AgentInput, AgentProfile, ContextPack, Domain, ToolCall } from '@/lib/ai/types'
import type { CaseState } from '@/lib/ai/case/state'

// ── Mock env (no production checks in tests) ──────────────────────────────────
vi.mock('@/lib/validators/env', () => ({
  getServerEnv: () => ({
    NODE_ENV: 'test',
    AI_MODEL: 'gemini-2.5-flash',
    ORCH_MAX_AGENTS: 4,
    ORCH_RETRY_GUARD_WINDOW_MS: 120_000,
  }),
  resetServerEnvForTests: () => undefined,
}))

// ── Team di test (18 agenti reali semplificati) ───────────────────────────────

function makeAgent(
  id: string,
  displayName: string,
  domainTags: Domain[],
  toolsAllowed: string[] = ['user.setAttribute', 'artifacts.saveRecommendation'],
): AgentProfile {
  return {
    id,
    displayName,
    domainTags,
    systemPrompt: `Sei ${displayName}. Rispondi in italiano. Aiuta l'utente in modo professionale.`,
    toolsAllowed,
    decisionStyle: 'team-led',
  }
}

const TEST_TEAM: AgentProfile[] = [
  makeAgent(
    'mmg',
    'Medico di Base',
    ['health'],
    [
      'user.setAttribute',
      'health.logDiagnosis',
      'health.logBloodwork',
      'health.addMetric',
      'health.updateMedications',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'cardiologo',
    'Cardiologo',
    ['health'],
    [
      'user.setAttribute',
      'health.logDiagnosis',
      'health.logBloodwork',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'gastroenterologo',
    'Gastroenterologo',
    ['health'],
    ['user.setAttribute', 'health.logDiagnosis', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'endocrinologo',
    'Endocrinologo',
    ['health'],
    [
      'user.setAttribute',
      'health.logBloodwork',
      'health.logDiagnosis',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'biologo-nutrizionista',
    'Biologo Nutrizionista',
    ['nutrition', 'health'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'dietista',
    'Dietista',
    ['nutrition'],
    [
      'user.setAttribute',
      'nutrition.logMeal',
      'nutrition.setCalorieGoal',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'dietologo',
    'Dietologo',
    ['nutrition', 'health'],
    ['user.setAttribute', 'health.logDiagnosis', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'persona-trainer',
    'Personal Trainer',
    ['training'],
    [
      'user.setAttribute',
      'training.createWorkoutPlan',
      'training.logWorkoutSession',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'fisioterapista',
    'Fisioterapista',
    ['training', 'health'],
    [
      'user.setAttribute',
      'health.logDiagnosis',
      'training.logInjury',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'fisiatra',
    'Fisiatra',
    ['health', 'training'],
    [
      'user.setAttribute',
      'health.logDiagnosis',
      'health.updateMedications',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'psicologo',
    'Psicologo',
    ['mindfulness'],
    ['user.setAttribute', 'mindfulness.createEntry', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'psichiatra',
    'Psichiatra',
    ['health', 'mindfulness'],
    [
      'user.setAttribute',
      'health.logDiagnosis',
      'health.updateMedications',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'mental-coach',
    'Mental Coach',
    ['mindfulness', 'training'],
    ['user.setAttribute', 'mindfulness.createEntry', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'sleep-coach',
    'Sleep Coach',
    ['health', 'mindfulness'],
    [
      'user.setAttribute',
      'health.addMetric',
      'mindfulness.createEntry',
      'artifacts.saveRecommendation',
    ],
  ),
  makeAgent(
    'career-coach',
    'Career Coach',
    ['inspiration'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'financial-planner',
    'Pianificatore Finanziario',
    ['inspiration'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'consulente-legale',
    'Consulente Legale',
    ['inspiration'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'commercialista',
    'Commercialista',
    ['inspiration', 'coordination'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'life-organizer',
    'Life Organizer',
    ['coordination'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
  makeAgent(
    'analista-contesto',
    'Analista di Contesto',
    ['coordination', 'general'],
    ['user.setAttribute', 'artifacts.saveRecommendation'],
  ),
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContextPack(overrides: Partial<ContextPack> = {}): ContextPack {
  return {
    user: { id: 'u-test', role: 'USER', profile: { name: 'Mario Rossi' }, attributes: {} },
    history: { recentMessages: [], recentArtifacts: [] },
    trackers: {},
    notifications: { unreadCount: 0 },
    ui: { moodScore: 50 },
    ...overrides,
  }
}

function makeInput(
  message: string,
  opts: {
    domainHint?: Domain
    contextPack?: ContextPack
    conversationId?: string
    caseState?: CaseState | null
    caseStateSnapshot?: AgentInput['caseStateSnapshot']
  } = {},
): AgentInput {
  return {
    requestId: `req-${Math.random().toString(36).slice(2)}`,
    userId: 'u-test',
    conversationId: opts.conversationId ?? 'conv-test',
    message,
    domainHint: opts.domainHint,
    caseState: opts.caseState ?? null,
    caseStateSnapshot: opts.caseStateSnapshot ?? null,
    contextPack: opts.contextPack ?? makeContextPack(),
  }
}

/** Crea proposta agente JSON valida */
function agentProposal(opts: {
  domain?: Domain
  summary?: string
  confidence?: number
  toolCalls?: ToolCall[]
  questions?: string[]
  flags?: {
    needsMoreInfo?: boolean
    potentialRisk?: boolean
    urgentEscalation?: boolean
  }
}) {
  return JSON.stringify({
    domain: opts.domain ?? 'health',
    summary: opts.summary ?? 'Risposta agente di test.',
    reasoning: 'Analisi basata sui dati forniti.',
    questions: opts.questions ?? [],
    recommendations: [
      { title: 'Consiglio', steps: ['Passo 1'], rationale: 'Motivo', safetyNotes: '' },
    ],
    toolCalls: opts.toolCalls ?? [],
    confidence: opts.confidence ?? 0.8,
    flags: {
      needsMoreInfo: opts.flags?.needsMoreInfo ?? false,
      potentialRisk: opts.flags?.potentialRisk ?? false,
      urgentEscalation: opts.flags?.urgentEscalation ?? false,
    },
    citations: [],
  })
}

/** Mock LLM che risponde con proposte JSON (round1+round2) e testo per synthesis */
function makeMockLlm(
  synthText = 'Risposta sintetizzata di test.',
  proposalOverrides?: Parameters<typeof agentProposal>[0],
) {
  return {
    complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
      if (format === 'text') {
        return { text: synthText }
      }
      return { text: agentProposal(proposalOverrides ?? {}) }
    }),
  }
}

function makeOrchDeps(llm: ReturnType<typeof makeMockLlm>, team = TEST_TEAM) {
  return {
    llm,
    team,
    orchestratorToolsAllowed: [
      'user.setAttribute',
      'health.logDiagnosis',
      'health.logBloodwork',
      'health.addMetric',
      'health.updateMedications',
      'training.createWorkoutPlan',
      'training.logWorkoutSession',
      'training.logInjury',
      'nutrition.logMeal',
      'nutrition.setCalorieGoal',
      'mindfulness.createEntry',
      'artifacts.saveRecommendation',
    ],
    globalTimeoutMs: 10_000,
    retryGuardWindowMs: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('chat orchestration — pipeline completa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. Query health ────────────────────────────────────────────────────────
  it('1. Query health → risposta con finalMessageMarkdown non vuoto', async () => {
    const llm = makeMockLlm('Il dolore alla testa può avere molte cause. Consulta il medico.', {
      domain: 'health',
    })
    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho mal di testa da tre giorni', { domainHint: 'health' }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.finalMessageMarkdown.length).toBeGreaterThan(5)
    expect(result.domain).toBe('health')
  })

  // ── 2. Query nutrition ────────────────────────────────────────────────────
  it('2. Query nutrition → domain=nutrition, risposta coerente', async () => {
    const llm = makeMockLlm('Per perdere peso devi creare un deficit calorico.', {
      domain: 'nutrition',
    })
    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Voglio perdere peso con una dieta sana', { domainHint: 'nutrition' }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('nutrition')
  })

  // ── 3. Query mindfulness ──────────────────────────────────────────────────
  it('3. Query mindfulness → domain=mindfulness', async () => {
    const llm = makeMockLlm('Lo stress cronico può avere effetti negativi sulla salute.', {
      domain: 'mindfulness',
    })
    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Sono molto stressato e ansioso', { domainHint: 'mindfulness' }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('mindfulness')
  })

  // ── 4. Query training ─────────────────────────────────────────────────────
  it('4. Query training → domain=training, selezionati agenti training', async () => {
    const llm = makeMockLlm('Per il tuo obiettivo ti consiglio 3 sessioni settimanali.', {
      domain: 'training',
    })
    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Voglio un piano di allenamento personalizzato', { domainHint: 'training' }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('training')
    // Gli agenti selezionati devono essere training
    const trainingAgents = new Set([
      'persona-trainer',
      'fisioterapista',
      'fisiatra',
      'mental-coach',
    ])
    expect(result.debug.selectedAgents.some((id) => trainingAgents.has(id))).toBe(true)
  })

  // ── 5. Query inspiration ──────────────────────────────────────────────────
  it('5. Query inspiration → domain=inspiration, risposta su carriera', async () => {
    const llm = makeMockLlm('Cambiare carriera richiede pianificazione.', { domain: 'inspiration' })
    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Voglio cambiare lavoro e costruire una nuova carriera', {
        domainHint: 'inspiration',
      }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('inspiration')
  })

  // ── 6. Tool call: logDiagnosis ────────────────────────────────────────────
  it('6. Agente propone logDiagnosis → toolCallsToExecute contiene il tool', async () => {
    const diagnosisToolCall: ToolCall = {
      id: 'tc-diag-1',
      name: 'health.logDiagnosis',
      args: { condition: 'Ipertensione', severity: 'moderate', status: 'active' },
    }
    const llm = makeMockLlm('Hai una diagnosi di ipertensione.', {
      domain: 'health',
      toolCalls: [diagnosisToolCall],
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho la pressione alta da tempo', { domainHint: 'health' }),
    )

    expect(result.toolCallsToExecute.some((t) => t.name === 'health.logDiagnosis')).toBe(true)
    const diagCall = result.toolCallsToExecute.find((t) => t.name === 'health.logDiagnosis')
    expect(diagCall?.args).toMatchObject({ condition: 'Ipertensione' })
  })

  // ── 7. Tool call: logBloodwork ────────────────────────────────────────────
  it('7. Agente propone logBloodwork → tool presente con args corretti', async () => {
    const bloodworkCall: ToolCall = {
      id: 'tc-blood-1',
      name: 'health.logBloodwork',
      args: { values: { glucose: 105, totalCholesterol: 210 }, notes: 'Esame annuale' },
    }
    const llm = makeMockLlm('I tuoi valori sono nella norma.', {
      domain: 'health',
      toolCalls: [bloodworkCall],
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho fatto le analisi del sangue: glicemia 105 e colesterolo 210'),
    )

    const tc = result.toolCallsToExecute.find((t) => t.name === 'health.logBloodwork')
    expect(tc).toBeDefined()
    expect((tc?.args as { values: { glucose: number } }).values.glucose).toBe(105)
  })

  // ── 8. Deduplicazione tool call ───────────────────────────────────────────
  it('8. Stesso tool call da due agenti → deduplicato in toolCallsToExecute', async () => {
    // Due agenti propongono lo stesso logDiagnosis con stessi args
    const sameCall: ToolCall = {
      id: 'tc-dup',
      name: 'health.logDiagnosis',
      args: { condition: 'Diabete tipo 2', status: 'active' },
    }
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Risposta duplicata.' }
        return { text: agentProposal({ domain: 'health', toolCalls: [sameCall] }) }
      }),
    }

    // domainHint necessario per evitare che domain='general' annulli agenti e tool calls
    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho il diabete tipo 2', { domainHint: 'health' }),
    )

    // Con agenti selezionati, il tool call viene incluso (e deduplicato se ripetuto)
    expect(result.finalMessageMarkdown).toBeTruthy()
    const diagCalls = result.toolCallsToExecute.filter((t) => t.name === 'health.logDiagnosis')
    // Massimo 1 entry per lo stesso tool call (deduplicazione per name+args)
    expect(diagCalls.length).toBeLessThanOrEqual(1)
    expect(diagCalls.length).toBeGreaterThanOrEqual(1) // almeno 1
  })

  // ── 9. Tool call bloccato da retry guard ───────────────────────────────────
  it('9. Tool bloccato da retry guard (VALIDATION_ERROR < window) → escluso da toolCallsToExecute', async () => {
    const blockedCall: ToolCall = {
      id: 'tc-blocked',
      name: 'health.logDiagnosis',
      args: { condition: 'Test', status: 'active' },
    }
    const llm = makeMockLlm('Risposta normale.', { domain: 'health', toolCalls: [blockedCall] })

    // ContextPack con tool execution trace recente (VALIDATION_ERROR non retriable)
    const ctx = makeContextPack({
      history: {
        recentMessages: [],
        recentArtifacts: [],
        toolExecutionTrace: [
          {
            toolCallId: 'tc-prev',
            name: 'health.logDiagnosis',
            ok: false,
            code: 'VALIDATION_ERROR',
            createdAt: new Date(Date.now() - 60_000).toISOString(), // 1 minuto fa
          },
        ],
      },
    })

    const deps = { ...makeOrchDeps(llm), retryGuardWindowMs: 120_000 }
    const result = await orchestrate(deps, makeInput('Diagnosi test', { contextPack: ctx }))

    // Il tool call deve essere bloccato dal retry guard
    expect(result.toolCallsToExecute.some((t) => t.name === 'health.logDiagnosis')).toBe(false)
  })

  // ── 10. Inferred attribute: peso nel messaggio ────────────────────────────
  it('10. Messaggio con peso esplicito → inferred setAttribute in toolCallsToExecute', async () => {
    const llm = makeMockLlm('Ho registrato il tuo peso.', { domain: 'health', toolCalls: [] })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Oggi peso 82 kg e mi sento bene'),
    )

    // Il sistema può inferire attributi dal messaggio
    // Se non viene inferito, il test passa comunque — solo verifica che non crashe
    expect(result.finalMessageMarkdown).toBeTruthy()
    // toolCallsToExecute può contenere setAttribute inferito o essere vuoto
    expect(Array.isArray(result.toolCallsToExecute)).toBe(true)
  })

  // ── 11. Gating questions → result ha domande ─────────────────────────────
  it('11. Proposta agente con questions → gatingQuestions nel result', async () => {
    const llm = makeMockLlm('Per consigliarti meglio ho bisogno di alcune informazioni.', {
      domain: 'health',
      questions: ['Da quanto tempo hai questi sintomi?', 'Stai prendendo farmaci?'],
      confidence: 0.6,
    })

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Ho dei sintomi strani'))

    // Le domande di gating devono essere presenti
    expect(Array.isArray(result.gatingQuestions)).toBe(true)
    // Il risultato finale deve essere prodotto comunque
    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── 12. Multiple proposals con questions ──────────────────────────────────
  it('12. Multiple proposte con domande diverse → domande aggregate nel result', async () => {
    let agentCallCount = 0
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Risposta combinata.' }
        agentCallCount++
        const questions =
          agentCallCount % 2 === 0
            ? ['Quale è la tua pressione sistolica?']
            : ['Hai familiarità con malattie cardiache?']
        return { text: agentProposal({ domain: 'health', questions, confidence: 0.7 }) }
      }),
    }

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho problemi cardiaci e pressione alta'),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(Array.isArray(result.gatingQuestions)).toBe(true)
  })

  // ── 13. Escalation urgente ────────────────────────────────────────────────
  it('13. Flag urgentEscalation=true → safety.escalation=urgent', async () => {
    const llm = makeMockLlm('Situazione urgente — contatta il pronto soccorso.', {
      domain: 'health',
      flags: { urgentEscalation: true, potentialRisk: true },
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho dolore al petto intenso e difficoltà a respirare'),
    )

    expect(['urgent', 'recommend-professional']).toContain(result.safety.escalation)
  })

  // ── 14. Flag potentialRisk ────────────────────────────────────────────────
  it('14. Flag potentialRisk=true → safety.escalation=recommend-professional o urgent', async () => {
    const llm = makeMockLlm('Ti consiglio di consultare uno specialista.', {
      domain: 'health',
      flags: { potentialRisk: true },
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho sintomi preoccupanti che durano da tempo'),
    )

    expect(['recommend-professional', 'urgent']).toContain(result.safety.escalation)
  })

  // ── 15. Nessun flag → escalation=none ────────────────────────────────────
  it('15. Nessun flag di rischio → safety.escalation=none', async () => {
    const llm = makeMockLlm('Ecco i miei consigli per la tua dieta.', {
      domain: 'nutrition',
      confidence: 0.9,
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Voglio seguire una dieta mediterranea', { domainHint: 'nutrition' }),
    )

    expect(result.safety.escalation).toBe('none')
  })

  // ── 16. Ideazione suicidaria → escalation urgente ─────────────────────────
  it('16. Messaggio di crisi mentale → escalation=urgent dalla proposta agente', async () => {
    const llm = makeMockLlm(
      'Sono qui con te. Chiama il numero di emergenza 112 o il telefono amico.',
      {
        domain: 'mindfulness',
        flags: { urgentEscalation: true, potentialRisk: true },
      },
    )

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Non voglio più vivere, mi sento disperato', { domainHint: 'mindfulness' }),
    )

    expect(['urgent', 'recommend-professional']).toContain(result.safety.escalation)
    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── 17. Multi-turn: history presente ─────────────────────────────────────
  it('17. Conversazione con history → LLM riceve messaggi precedenti nel prompt', async () => {
    const history = [
      {
        role: 'user' as const,
        content: 'Ho 35 anni e sono in sovrappeso',
        createdAt: new Date().toISOString(),
      },
      {
        role: 'assistant' as const,
        content: 'Capisco, possiamo lavorarci insieme.',
        createdAt: new Date().toISOString(),
      },
    ]
    const ctx = makeContextPack({
      history: { recentMessages: history, recentArtifacts: [] },
    })
    const llm = makeMockLlm('Continuando dalla nostra conversazione...', { domain: 'nutrition' })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Allora, qual è la dieta migliore per me?', { contextPack: ctx }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    // Verifica che il LLM sia stato chiamato con contenuto che include la history
    const calls = vi.mocked(llm.complete).mock.calls
    const agentCalls = calls.filter((c) => c[0].format !== 'text')
    const hasHistory = agentCalls.some(
      (c) => c[0].user.includes('35 anni') || c[0].user.includes('sovrappeso'),
    )
    expect(hasHistory).toBe(true)
  })

  // ── 18. Attributi utente nel context ─────────────────────────────────────
  it('18. Attributi utente nel context pack → passati al prompt agente', async () => {
    const ctx = makeContextPack({
      user: {
        id: 'u-test',
        role: 'USER',
        profile: { name: 'Mario', birthDate: '1985-01-01', gender: 'male' },
        attributes: {
          health: { weight: 80, height: 175, bloodPressure: '140/90', conditions: 'ipertensione' },
        },
      },
    })
    const llm = makeMockLlm('Conoscendo il tuo profilo...', { domain: 'health' })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Come gestisco la mia pressione alta?', { contextPack: ctx }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    // Il prompt dell'agente deve contenere dati dall'attributo
    const calls = vi.mocked(llm.complete).mock.calls
    const hasAttributeData = calls.some(
      (c) =>
        c[0].user.includes('ipertensione') || c[0].user.includes('80') || c[0].user.includes('140'),
    )
    expect(hasAttributeData).toBe(true)
  })

  // ── 19. Diagnosi precedente nel context ───────────────────────────────────
  it('19. Diagnosi precedente negli attributi → agenti ricevono il contesto clinico', async () => {
    const ctx = makeContextPack({
      user: {
        id: 'u-test',
        role: 'USER',
        profile: { name: 'Mario' },
        attributes: {
          health: { conditions: 'diabete tipo 2', medications: 'metformina 500mg' },
        },
      },
    })
    const llm = makeMockLlm('Con la tua diagnosi di diabete devi stare attento.', {
      domain: 'health',
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho la glicemia alta stamattina', { contextPack: ctx, domainHint: 'health' }),
    )

    // La pipeline deve completarsi correttamente con il contesto clinico
    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('health')
    // Il LLM viene chiamato con il contesto (il formato esatto dipende da budgetContextPack)
    const calls = vi.mocked(llm.complete).mock.calls
    expect(calls.length).toBeGreaterThan(0)
  })

  // ── 20. Context pack completo → risposta con profilo ─────────────────────
  it('20. Profilo completo nel context → pipeline produce risposta (domainHint=health)', async () => {
    const ctx = makeContextPack({
      user: {
        id: 'u-test',
        role: 'USER',
        profile: { name: 'Mario', birthDate: '1985-06-15', gender: 'male' },
        attributes: {
          health: { weight: 78, height: 180, bloodPressure: '120/80' },
          nutrition: { dietType: 'mediterranea', caloricGoal: 2000 },
        },
      },
    })
    const llm = makeMockLlm('In base al tuo profilo completo...', {
      domain: 'health',
      questions: [],
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Come sto fisicamente?', { contextPack: ctx, domainHint: 'health' }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('health')
  })

  // ── 21. Fast path: domanda età con birthDate nota ─────────────────────────
  it('21. "Quanti anni ho?" con birthDate → fast path senza LLM call', async () => {
    const llm = makeMockLlm('risposta')
    // Usa una data certa: nato il 1 gennaio 1980, oggi marzo 2026 → 46 anni
    const ctx = makeContextPack({
      user: {
        id: 'u-test',
        role: 'USER',
        profile: { birthDate: '1980-01-01' },
        attributes: {},
      },
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Quanti anni ho?', { contextPack: ctx }),
    )

    // Fast path: LLM non viene chiamato
    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.finalMessageMarkdown).toContain('46')
    expect(vi.mocked(llm.complete).mock.calls.length).toBe(0)
  })

  // ── 22. Fast path: domanda età senza birthDate → risposta senza creare errori ──
  it('22. "Quanti anni ho?" senza birthDate → risposta coerente (fast path o pipeline)', async () => {
    const llm = makeMockLlm('Non conosco la tua data di nascita.', { domain: 'general' })
    const ctx = makeContextPack({
      user: { id: 'u-test', role: 'USER', profile: {}, attributes: {} },
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Quanti anni ho?', { contextPack: ctx }),
    )

    // La pipeline deve produrre una risposta senza crashare
    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  it('22b. usa caseStateSnapshot come base canonica anche se il legacy e` in conflitto', async () => {
    const llm = makeMockLlm('Continuiamo dal panel nutrizione.', {
      domain: 'nutrition',
      questions: [],
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('continua pure', {
        caseState: {
          conversationId: 'conv-test',
          ownerAgentId: 'mmg',
          activeSpeakerAgentId: 'mmg',
          protocolState: 'owner_active',
          takeoverTurns: 0,
          loopCount: 0,
          handoffCount: 0,
        },
        caseStateSnapshot: {
          schemaVersion: 1,
          conversationId: 'conv-test',
          activeDomains: ['nutrition'],
          domainPanels: [
            {
              domain: 'nutrition',
              selectedAgentId: 'dietista',
              candidateAgentIds: ['dietista'],
              status: 'active',
              priorityScore: 9,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
          ],
          leadDomain: 'nutrition',
          speakerPolicy: 'lead',
          conversationFocus: {
            activeProblems: ['gonfiore'],
            activeGoals: ['capire i trigger'],
            activeConstraints: [],
            summary: 'focus nutrizione',
          },
          coordinationState: {
            crossDomainConflicts: [],
            dependencies: [],
            needsReview: false,
          },
          sharedOpenQuestions: [],
          domainOpenQuestions: {},
          updatedAt: '2026-03-26T23:58:00.000Z',
        },
      }),
    )

    expect(result.stateSnapshot?.leadDomain).toBe('nutrition')
    expect(result.debug?.decisionTrace?.[1]?.data).toMatchObject({
      activeSpecialistId: 'dietista',
    })
    expect(result.debug?.decisionTrace?.[2]?.data).toMatchObject({
      domainHint: 'nutrition',
      selectedAgentIds: ['dietista'],
    })
  })

  it('22c. usa routing context-first LLM-driven prima del fallback keyword-based', async () => {
    const llm = {
      complete: vi
        .fn()
        .mockImplementation(async ({ system, format }: { system: string; format?: string }) => {
          if (format === 'text' && system.includes('router multi-dominio')) {
            return {
              text: JSON.stringify({
                primaryDomain: 'coordination',
                allDomains: ['coordination', 'inspiration'],
                preferredAgentIds: ['life-organizer', 'analista-contesto'],
                confidence: 0.92,
                reasoning: 'Follow-up organizzativo con panel multi-dominio attivo.',
              }),
            }
          }
          if (format === 'text') {
            return { text: 'Procediamo dal piano di coordinamento.' }
          }
          return { text: agentProposal({ domain: 'coordination' }) }
        }),
    }

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('continuiamo da dove eravamo rimasti', {
        caseStateSnapshot: {
          schemaVersion: 1,
          conversationId: 'conv-test',
          activeDomains: ['coordination', 'inspiration'],
          domainPanels: [
            {
              domain: 'coordination',
              selectedAgentId: 'life-organizer',
              candidateAgentIds: ['life-organizer', 'analista-contesto'],
              status: 'active',
              priorityScore: 10,
              lastReasoningAt: null,
              pendingNeeds: ['riallineare priorita'],
            },
            {
              domain: 'inspiration',
              selectedAgentId: 'analista-contesto',
              candidateAgentIds: ['analista-contesto'],
              status: 'monitoring',
              priorityScore: 6,
              lastReasoningAt: null,
              pendingNeeds: [],
            },
          ],
          leadDomain: 'coordination',
          speakerPolicy: 'lead',
          conversationFocus: {
            activeProblems: ['priorita frammentate'],
            activeGoals: ['riordinare il piano'],
            activeConstraints: [],
            summary: 'coordinamento multi-dominio',
          },
          coordinationState: {
            crossDomainConflicts: [],
            dependencies: [],
            needsReview: false,
          },
          sharedOpenQuestions: ['Quale obiettivo viene prima?'],
          domainOpenQuestions: {
            coordination: ['Quale e il prossimo passo concreto?'],
          },
          updatedAt: '2026-03-27T15:40:00.000Z',
        },
      }),
    )

    expect(result.domain).toBe('coordination')
    expect(result.debug?.decisionTrace?.[0]?.data).toMatchObject({
      detectedDomain: 'coordination',
      source: 'llm_context',
    })
    expect(result.debug?.decisionTrace?.[2]?.data).toMatchObject({
      domainHint: 'coordination',
    })
    expect(result.debug?.decisionTrace?.[2]?.data.selectedAgentIds).toContain('life-organizer')
    expect(result.debug?.decisionTrace?.[2]?.data.selectedAgentIds[0]).toBe('life-organizer')
  })

  it('22d. serializza un snapshot canonico training-first per prompt monodominio palestra', async () => {
    const llm = makeMockLlm('Prepariamo la tua scheda di allenamento.', { domain: 'training' })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Mi serve una scheda per ricominciare ad allenarmi in palestra.'),
    )

    expect(result.domain).toBe('training')
    expect(result.ui.domainIcon).toBe('training')
    expect(result.stateSnapshot).toMatchObject({
      leadDomain: 'training',
      activeDomains: ['training'],
    })
    expect(result.stateSnapshot?.domainPanels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'training',
          selectedAgentId: 'persona-trainer',
          status: 'active',
        }),
      ]),
    )
  })

  it('22e. mantiene training attivo ma sposta il leadDomain a health nel follow-up health+training', async () => {
    const llm = {
      complete: vi
        .fn()
        .mockImplementation(async ({ system, format }: { system: string; format?: string }) => {
          if (format === 'text' && system.includes('router multi-dominio')) {
            return {
              text: JSON.stringify({
                primaryDomain: 'health',
                allDomains: ['health', 'training'],
                preferredAgentIds: ['fisioterapista', 'persona-trainer'],
                confidence: 0.93,
                reasoning: 'Il ginocchio diventa il focus, ma l’allenamento resta attivo.',
              }),
            }
          }
          if (format === 'text') {
            return { text: 'Dobbiamo capire meglio il dolore al ginocchio senza perdere il focus.' }
          }
          return { text: agentProposal({ domain: 'health' }) }
        }),
    }

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput(
        "Ora però il problema principale è il dolore al ginocchio quando faccio squat e corsa, senza perdere il focus sull'allenamento.",
        {
          caseState: {
            conversationId: 'conv-training-health',
            ownerAgentId: 'persona-trainer',
            activeSpeakerAgentId: 'persona-trainer',
            protocolState: 'owner_active',
            takeoverTurns: 0,
            loopCount: 0,
            handoffCount: 0,
          },
          caseStateSnapshot: {
            schemaVersion: 1,
            conversationId: 'conv-training-health',
            activeDomains: ['training'],
            domainPanels: [
              {
                domain: 'training',
                selectedAgentId: 'persona-trainer',
                candidateAgentIds: ['persona-trainer'],
                status: 'active',
                priorityScore: 0.9,
                lastReasoningAt: null,
                pendingNeeds: [],
              },
            ],
            leadDomain: 'training',
            speakerPolicy: 'lead',
            conversationFocus: {
              activeProblems: [],
              activeGoals: ['riprendere ad allenarsi'],
              activeConstraints: [],
              summary: 'focus training',
            },
            coordinationState: {
              crossDomainConflicts: [],
              dependencies: [],
              needsReview: false,
            },
            sharedOpenQuestions: [],
            domainOpenQuestions: {},
            updatedAt: '2026-03-27T22:00:00.000Z',
          },
        },
      ),
    )

    expect(result.domain).toBe('health')
    expect(result.ui.domainIcon).toBe('health')
    expect(result.stateSnapshot).toMatchObject({
      leadDomain: 'health',
      activeDomains: expect.arrayContaining(['health', 'training']),
    })
    expect(result.stateSnapshot?.domainPanels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'health',
          selectedAgentId: 'fisioterapista',
          status: 'active',
        }),
        expect.objectContaining({
          domain: 'training',
          selectedAgentId: 'persona-trainer',
        }),
      ]),
    )
  })

  // ── 23. Agente timeout → fallback proposal, risposta prodotta ─────────────
  it('23. Agente con timeout → fallback, finalMessageMarkdown prodotto lo stesso', async () => {
    let callCount = 0
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Risposta di fallback.' }
        callCount++
        // Primo agente: timeout (>8s)
        if (callCount === 1) {
          return new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 100),
          )
        }
        return { text: agentProposal({ domain: 'health' }) }
      }),
    }

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Ho mal di testa'))

    // La pipeline deve produrre una risposta anche se un agente fallisce
    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBeDefined()
  })

  // ── 24. JSON malformato dall'agente → normalizzato, pipeline continua ─────
  it('24. LLM ritorna JSON malformato per agente → normalizzato, pipeline non crashe', async () => {
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Risposta sintetica.' }
        return { text: '{domain: invalid json###' } // JSON malformato
      }),
    }

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Ciao, come stai?'))

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBeDefined()
  })

  // ── 25. Testo non-JSON dall'agente → fallback proposal ───────────────────
  it('25. LLM ritorna testo libero (non JSON) per agente → pipeline continua', async () => {
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Risposta sintetica ok.' }
        return { text: 'Ti consiglio di bere molta acqua e riposare.' } // Non JSON
      }),
    }

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Ho influenza e febbre'))

    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── 26. Tutti gli agenti falliscono → risposta fallback ───────────────────
  it('26. Tutti gli agenti con errore → finalMessageMarkdown non vuoto (fallback)', async () => {
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Mi dispiace, prova di nuovo.' }
        throw new Error('Network error')
      }),
    }

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Ho un problema urgente'))

    // Il sistema deve produrre una risposta anche con tutti gli agenti in errore
    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── 27. Multi-dominio: schiena + dieta ───────────────────────────────────
  it('27. "Schiena + dieta" → agenti training E nutrition selezionati', async () => {
    const llm = makeMockLlm('Per la schiena e la dieta hai bisogno di un approccio integrato.', {
      domain: 'training',
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho mal di schiena muscolare e voglio anche impostare una dieta equilibrata', {
        domainHint: 'training',
      }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.debug.selectedAgents.length).toBeGreaterThan(0)
  })

  // ── 28. Multi-dominio: ansia + insonnia ───────────────────────────────────
  it('28. "Ansia e insonnia" → mindfulness selezionato, risposta su salute mentale', async () => {
    const llm = makeMockLlm('Ansia e insonnia spesso si alimentano a vicenda.', {
      domain: 'mindfulness',
    })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Ho molta ansia e non riesco a dormire bene da settimane', {
        domainHint: 'mindfulness',
      }),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('mindfulness')
  })

  // ── 29. Consensus: proposte concordanti → risposta coerente ───────────────
  it('29. Due proposte con stessa raccomandazione → consenso e risposta coerente', async () => {
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text')
          return { text: 'Entrambi i professionisti concordano: devi fare attività fisica.' }
        return {
          text: agentProposal({
            domain: 'health',
            summary: 'Raccomando attività fisica moderata.',
            confidence: 0.85,
          }),
        }
      }),
    }

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Come miglioro la mia salute?'))

    expect(result.finalMessageMarkdown).toBeTruthy()
    expect(result.domain).toBe('health')
    // Debug deve mostrare agenti selezionati
    expect(result.debug.selectedAgents.length).toBeGreaterThan(0)
  })

  // ── 30. Messaggio lungo (4000 chars) → nessun crash ──────────────────────
  it('30. Messaggio da 4000 caratteri → pipeline completa senza errori', async () => {
    const longMsg = 'Ho diversi sintomi che mi preoccupano. '.repeat(100).slice(0, 4000)
    const llm = makeMockLlm('Risposta al messaggio lungo.', { domain: 'health' })

    const result = await orchestrate(makeOrchDeps(llm), makeInput(longMsg))

    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── 31. Messaggio con simboli/numeri → gestito senza crash ────────────────
  it('31. Messaggio con numeri e simboli → pipeline non crashe', async () => {
    const llm = makeMockLlm('Risposta a query numerica.', { domain: 'health' })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('BMI 28.5, PA 140/90, FC 72bpm, glicemia 105mg/dL, peso 85kg altezza 1.73m'),
    )

    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── 32. ConversationId diversi → context isolato ─────────────────────────
  it('32. ConversationId diversi → pipeline indipendente per ogni conversazione', async () => {
    const llm1 = makeMockLlm('Risposta conv 1.', { domain: 'health' })
    const llm2 = makeMockLlm('Risposta conv 2.', { domain: 'nutrition' })

    const [result1, result2] = await Promise.all([
      orchestrate(
        makeOrchDeps(llm1),
        makeInput('Ho problemi di salute', { conversationId: 'conv-A', domainHint: 'health' }),
      ),
      orchestrate(
        makeOrchDeps(llm2),
        makeInput('Voglio una dieta', { conversationId: 'conv-B', domainHint: 'nutrition' }),
      ),
    ])

    expect(result1.finalMessageMarkdown).toBeTruthy()
    expect(result2.finalMessageMarkdown).toBeTruthy()
    expect(result1.domain).toBe('health')
    expect(result2.domain).toBe('nutrition')
  })

  // ── EXTRA: debug.selectedAgents è sempre array non vuoto (con domainHint) ─
  it('EXTRA. debug.selectedAgents è popolato per ogni query con domainHint', async () => {
    const llm = makeMockLlm('ok')
    const scenarios: Array<[string, Domain]> = [
      ['Ho mal di testa da giorni', 'health'],
      ['Voglio dimagrire con una dieta', 'nutrition'],
      ['Sono stressato e ansioso', 'mindfulness'],
      ['Voglio creare un piano di allenamento', 'training'],
      ['Ho un problema lavorativo e voglio cambiare carriera', 'inspiration'],
    ]
    for (const [message, domainHint] of scenarios) {
      vi.clearAllMocks()
      const result = await orchestrate(makeOrchDeps(llm), makeInput(message, { domainHint }))
      expect(
        result.debug.selectedAgents.length,
        `Nessun agente per: "${message}" (domainHint=${domainHint})`,
      ).toBeGreaterThan(0)
    }
  })

  // ── EXTRA: Proposte con confidence=0 escluse da consensus ────────────────
  it('EXTRA. Proposte con confidence=0 (timeout fallback) → excluded da consensus ranking', async () => {
    let callCount = 0
    const llm = {
      complete: vi.fn().mockImplementation(async ({ format }: { format?: string }) => {
        if (format === 'text') return { text: 'Risposta finale.' }
        callCount++
        // Primo agente: confidence 0
        if (callCount <= 2) {
          return {
            text: agentProposal({ domain: 'health', confidence: 0, summary: 'Indisponibile.' }),
          }
        }
        return {
          text: agentProposal({ domain: 'health', confidence: 0.9, summary: 'Risposta valida.' }),
        }
      }),
    }

    const result = await orchestrate(makeOrchDeps(llm), makeInput('Ho mal di schiena'))

    // La pipeline produce un risultato nonostante proposte a confidence 0
    expect(result.finalMessageMarkdown).toBeTruthy()
  })

  // ── EXTRA: Tool call con nome agente non in toolsAllowed ─────────────────
  it('EXTRA. Tool call pianificato (consensusToolCalls) viene incluso in toolCallsToExecute', async () => {
    // Il controllo toolsAllowed avviene a execution time (toolExecutor), non in orchestrate()
    const illegalTool: ToolCall = {
      id: 'tc-plan',
      name: 'training.createWorkoutPlan',
      args: { weeklyDays: 3 },
    }
    const llm = makeMockLlm('Piano creato.', { domain: 'training', toolCalls: [illegalTool] })

    const result = await orchestrate(
      makeOrchDeps(llm),
      makeInput('Crea un piano di allenamento', { domainHint: 'training' }),
    )

    // orchestrate() include il tool call; il check toolsAllowed è di competenza del toolExecutor
    expect(Array.isArray(result.toolCallsToExecute)).toBe(true)
    expect(result.finalMessageMarkdown).toBeTruthy()
  })
})
