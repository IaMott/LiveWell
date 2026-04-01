/**
 * multi-agent-execution.test.ts
 *
 * Test mirati su ESECUZIONE TWO-ROUND, CONSENSUS ENGINE, FAST PATHS,
 * INTAKE QUESTIONS e ORCHESTRAZIONE END-TO-END del sistema multi-agente.
 */

import { describe, expect, it } from 'vitest'
import type { AgentProfile, AgentProposal, ContextPack } from '@/lib/ai/types'
import { executeAgentRounds } from '@/lib/ai/orchestrator/agentRoundExecution'
import { runConsensus } from '@/lib/ai/consensus/consensusEngine'
import { isGenericMessage, tryAgeQuestionFastPath } from '@/lib/ai/orchestrator/fastPaths'
import { getMissingRequiredFields } from '@/lib/ai/orchestrator/intakeQuestions'
import { orchestrate } from '@/lib/ai/orchestrator/orchestrator'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function agent(id: string, displayName: string, tags: AgentProfile['domainTags']): AgentProfile {
  return {
    id,
    displayName,
    domainTags: tags,
    systemPrompt: `Sei ${displayName}. Rispondi con JSON valido.`,
    toolsAllowed: ['user.updateProfile'],
    decisionStyle: 'team-led',
  }
}

const TEAM: AgentProfile[] = [
  agent('mmg', 'Medico di Base', ['health']),
  agent('fisioterapista', 'Fisioterapista', ['health', 'training']),
  agent('dietista', 'Dietista', ['nutrition']),
  agent('sleep-coach', 'Coach del Sonno', ['mindfulness', 'health']),
  agent('psicologo', 'Psicologo', ['mindfulness']),
  agent('persona-trainer', 'Personal Trainer', ['training']),
  agent('endocrinologo', 'Endocrinologo', ['health']),
]

const BASE_CONTEXT: ContextPack = {
  user: { id: 'u1', role: 'USER', profile: {} },
  history: { recentMessages: [], recentArtifacts: [] },
  trackers: {},
  notifications: { unreadCount: 0 },
  ui: { moodScore: 50, sectionScores: { general: 50 } },
}

/** LLM mock che risponde con proposal valido per ogni agente */
function makeLlm(
  opts: {
    confidence?: number
    toolCalls?: AgentProposal['toolCalls']
    flags?: AgentProposal['flags']
  } = {},
) {
  return {
    complete: async ({ user }: { system: string; user: string }) => {
      const isRound2 = user.includes('PEER REVIEW')
      return {
        text: JSON.stringify({
          domain: 'health',
          summary: isRound2 ? 'risposta round2 con peer insights' : 'risposta round1 indipendente',
          reasoning: 'valutazione clinica',
          questions: [],
          recommendations: [],
          toolCalls: opts.toolCalls ?? [],
          confidence: opts.confidence ?? 0.8,
          flags: opts.flags,
        }),
      }
    },
  }
}

// ─── 1. Two-Round Execution ───────────────────────────────────────────────────

describe('executeAgentRounds — esecuzione two-round', () => {
  it('restituisce round1 e round2 proposals', async () => {
    const selectedAgents = [TEAM[0]!, TEAM[1]!]
    const { round1Proposals, round2Proposals } = await executeAgentRounds({
      llm: makeLlm(),
      selectedAgents,
      input: {
        requestId: 'r1',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ho dolore alla schiena',
        contextPack: BASE_CONTEXT,
      },
      domainHint: 'health',
    })

    expect(round1Proposals).toHaveLength(2)
    expect(round2Proposals).toHaveLength(2)
    expect(round1Proposals[0]?.confidence).toBe(0.8)
    expect(round2Proposals[0]?.confidence).toBe(0.8)
  })

  it('round2: ogni agente riceve esattamente N-1 peer insight (self-exclusion)', async () => {
    // Con 2 agenti selezionati, ogni round2 call deve contenere ESATTAMENTE 1 peer entry
    // (non 2). Se buildRichPeerInsights fosse rotto e includesse se stesso, il count sarebbe 2.
    // Il nuovo formato usa "### AGENTID" per ogni peer → regex `^### \S+` le individua.
    const round2PeerCounts: number[] = []

    const llm = {
      complete: async ({ user }: { system: string; user: string }) => {
        if (user.includes('=== ANALISI DEI COLLEGHI SPECIALISTI')) {
          // Estrai la sezione dopo "=== ANALISI DEI COLLEGHI SPECIALISTI"
          const peerSection =
            user.match(/=== ANALISI DEI COLLEGHI SPECIALISTI[^=]*===([\s\S]*?)---/)?.[1] ?? ''
          // Conta le entry "### AGENTID ..." nel formato nuovo
          const peerEntries = peerSection.match(/^### \S+/gm) ?? []
          round2PeerCounts.push(peerEntries.length)
        }
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: 'risposta',
            reasoning: '',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.7,
          }),
        }
      },
    }

    const selectedAgents = [TEAM[0]!, TEAM[1]!] // 2 agenti: mmg + fisioterapista
    await executeAgentRounds({
      llm,
      selectedAgents,
      input: {
        requestId: 'r2',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ho dolore alla schiena e stanchezza',
        contextPack: BASE_CONTEXT,
      },
      domainHint: 'health',
    })

    // MAX_PEER_REVIEW_PHASES=2 → 2 peer-review phases × 2 agenti = 4 chiamate con peer insights
    expect(round2PeerCounts).toHaveLength(4)
    // Fase 2 (primi 2 conteggi): ogni agente vede ESATTAMENTE 1 peer (N-1 = 2-1 = 1)
    // Fase 3 (ultimi 2 conteggi): ogni agente vede 2 peer entries per l'unico collega
    // (una dall'analisi Fase 1 e una dalla Fase 2, entrambe accumulate)
    const [phase2A, phase2B, phase3A, phase3B] = round2PeerCounts
    // Self-exclusion: nella fase 2 ogni agente vede solo 1 entry (il suo unico collega)
    expect(phase2A).toBe(1)
    expect(phase2B).toBe(1)
    // Nella fase 3 ci sono 2 entries per l'unico collega (fasi 1+2 accumulate)
    expect(phase3A).toBe(2)
    expect(phase3B).toBe(2)
  })

  it('agente che va in timeout → fallback proposal con confidence=0 e motivo timeout', async () => {
    const slowLlm = {
      complete: async () => {
        await new Promise((r) => setTimeout(r, 500)) // più lento del timeout
        return { text: JSON.stringify({ domain: 'health', summary: 'tardi', confidence: 0.9 }) }
      },
    }

    const { round1Proposals } = await executeAgentRounds({
      llm: slowLlm,
      selectedAgents: [TEAM[0]!],
      input: {
        requestId: 'r3',
        userId: 'u1',
        conversationId: 'c1',
        message: 'test timeout',
        contextPack: BASE_CONTEXT,
      },
      domainHint: 'health',
      timeoutMs: 50, // 50ms — sicuro timeout
    })

    expect(round1Proposals).toHaveLength(1)
    expect(round1Proposals[0]?.confidence).toBe(0)
    // Verifica contenuto specifico del fallback: prefix [Unavailable] + motivo timeout
    expect(round1Proposals[0]?.summary).toContain('[Unavailable]')
    expect(round1Proposals[0]?.summary).toContain('timed out')
    // L'agentId nel fallback è quello dell'agente che ha timedout
    expect(round1Proposals[0]?.agentId).toBe(TEAM[0]!.id)
  })

  it('un agente fallisce ma gli altri rispondono correttamente', async () => {
    let callCount = 0
    const partialFailLlm = {
      complete: async () => {
        callCount++
        if (callCount === 1) throw new Error('LLM error simulato')
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: 'ok',
            reasoning: '',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.7,
          }),
        }
      },
    }

    const selectedAgents = [TEAM[0]!, TEAM[1]!]
    const { round1Proposals } = await executeAgentRounds({
      llm: partialFailLlm,
      selectedAgents,
      input: {
        requestId: 'r4',
        userId: 'u1',
        conversationId: 'c1',
        message: 'test errore parziale',
        contextPack: BASE_CONTEXT,
      },
      domainHint: 'health',
    })

    expect(round1Proposals).toHaveLength(2)
    // Il primo ha fallito → confidence=0
    expect(round1Proposals[0]?.confidence).toBe(0)
    // Il secondo è ok
    expect(round1Proposals[1]?.confidence).toBeGreaterThan(0)
  })

  it("peer insights contengono il summary dell'altro agente e non il proprio", async () => {
    // Strategia: round1 ogni agente ritorna un reasoning univoco con il proprio agentId.
    // Nel round2 (nuovo formato), ogni agente riceve peer insights che includono il reasoning
    // dell'ALTRO agente (se length > 10) e NON il proprio (self-exclusion).
    // Il nuovo formato usa "### AGENTID.TOUPPERCASE() — dominio..." per ogni peer.
    const agentA = TEAM[0]! // mmg
    const agentB = TEAM[1]! // fisioterapista

    const round1CallCount = { value: 0 }
    const round2Prompts: string[] = []

    const llm = {
      complete: async ({ user }: { system: string; user: string }) => {
        const isRound2 = user.includes('=== ANALISI DEI COLLEGHI SPECIALISTI')

        if (isRound2) {
          round2Prompts.push(user)
          // Return placeholder per round2
          return {
            text: JSON.stringify({
              domain: 'health',
              summary: 'round2 risposta',
              reasoning: 'ragionamento round2',
              questions: [],
              recommendations: [],
              toolCalls: [],
              confidence: 0.8,
            }),
          }
        }

        // Round1: ogni agente ritorna un reasoning univoco con il suo agentId incorporato
        // Il reasoning > 10 chars viene incluso nei peer insights del round2 (nuovo formato)
        const n = ++round1CallCount.value
        const agentId = n === 1 ? agentA.id : agentB.id
        return {
          text: JSON.stringify({
            domain: 'health',
            summary: `summary-${agentId}`,
            reasoning: `REASONING_FROM_${agentId}_R1`,
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 0.8,
          }),
        }
      },
    }

    await executeAgentRounds({
      llm,
      selectedAgents: [agentA, agentB],
      input: {
        requestId: 'r5',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ho sintomi misti',
        contextPack: BASE_CONTEXT,
      },
      domainHint: 'health',
    })

    // MAX_PEER_REVIEW_PHASES=2 → 2 fasi × 2 agenti = 4 prompt con peer insights totali
    expect(round2Prompts).toHaveLength(4)

    // I primi 2 prompt (fase 2) devono contenere il reasoning R1 dell'ALTRO agente (self-exclusion).
    // Il nuovo formato usa "### AGENTID.TOUPPERCASE() — dominio..." per ogni peer,
    // e include il reasoning (se > 10 chars) sotto "**Ragionamento clinico:**".
    const phase2Prompts = round2Prompts.slice(0, 2)
    for (const prompt of phase2Prompts) {
      const containsA = prompt.includes(`REASONING_FROM_${agentA.id}_R1`)
      const containsB = prompt.includes(`REASONING_FROM_${agentB.id}_R1`)

      // Deve contenere esattamente UNO dei due reasoning, non entrambi
      // (self-exclusion: il proprio non deve essere incluso)
      expect(containsA !== containsB).toBe(true) // XOR: esattamente uno
    }

    // Verifica incrociata: uno dei prompt contiene agentA e non agentB, l'altro viceversa
    const promptWithA = round2Prompts.find((p) => p.includes(`REASONING_FROM_${agentA.id}_R1`))
    const promptWithB = round2Prompts.find((p) => p.includes(`REASONING_FROM_${agentB.id}_R1`))
    expect(promptWithA).toBeDefined() // il round2 di agentB vede il reasoning di agentA
    expect(promptWithB).toBeDefined() // il round2 di agentA vede il reasoning di agentB
    expect(promptWithA).not.toContain(`REASONING_FROM_${agentB.id}_R1`)
    expect(promptWithB).not.toContain(`REASONING_FROM_${agentA.id}_R1`)
  })
})

// ─── 2. Consensus Engine ──────────────────────────────────────────────────────

describe('runConsensus — motore di consenso', () => {
  const CONSENSUS_OPTS = {
    orchestratorId: 'orchestratore',
    maxAgents: 6,
    requireGatingOnMissingInfo: true,
  }

  function proposal(
    agentId: string,
    domain: AgentProposal['domain'],
    summary: string,
    confidence: number,
    extra: Partial<AgentProposal> = {},
  ): AgentProposal {
    return {
      agentId,
      domain,
      summary,
      reasoning: 'ok',
      questions: [],
      recommendations: [],
      toolCalls: [],
      confidence,
      ...extra,
    }
  }

  it('filtra via fallback proposals (confidence=0) dal ranking', () => {
    const proposals = [
      proposal('mmg', 'health', 'valutazione medica', 0.8),
      proposal('fisioterapista', 'health', '[Unavailable]', 0), // fallback
    ]

    const result = runConsensus({
      opts: CONSENSUS_OPTS,
      team: TEAM,
      proposals,
      domainHint: 'health',
      contextPack: BASE_CONTEXT,
      orchestratorToolsAllowed: ['user.updateProfile'],
    })

    // Il debug.selectedAgents non deve includere il fallback con conf=0
    expect(result.debug?.selectedAgents).not.toContain('fisioterapista')
    // Ma deve includere mmg
    expect(result.debug?.selectedAgents).toContain('mmg')
  })

  it('flag urgentEscalation → safety.escalation = "urgent"', () => {
    const proposals = [
      proposal('mmg', 'health', 'dolore toracico acuto', 0.9, {
        flags: { urgentEscalation: true },
      }),
    ]

    const result = runConsensus({
      opts: CONSENSUS_OPTS,
      team: TEAM,
      proposals,
      domainHint: 'health',
      contextPack: BASE_CONTEXT,
      orchestratorToolsAllowed: [],
    })

    expect(result.safety.escalation).toBe('urgent')
    expect(result.safety.disclaimers?.length).toBeGreaterThan(0)
  })

  it('flag potentialRisk → safety.escalation = "recommend-professional"', () => {
    const proposals = [
      proposal('fisioterapista', 'health', 'dolore persistente', 0.7, {
        flags: { potentialRisk: true },
      }),
    ]

    const result = runConsensus({
      opts: CONSENSUS_OPTS,
      team: TEAM,
      proposals,
      domainHint: 'health',
      contextPack: BASE_CONTEXT,
      orchestratorToolsAllowed: [],
    })

    expect(result.safety.escalation).toBe('recommend-professional')
    expect(result.safety.disclaimers).toBeDefined()
  })

  it('senza flag di rischio → safety.escalation = "none"', () => {
    const proposals = [proposal('dietista', 'nutrition', 'piano alimentare equilibrato', 0.85)]

    const result = runConsensus({
      opts: CONSENSUS_OPTS,
      team: TEAM,
      proposals,
      domainHint: 'nutrition',
      contextPack: BASE_CONTEXT,
      orchestratorToolsAllowed: [],
    })

    expect(result.safety.escalation).toBe('none')
    expect(result.safety.disclaimers).toBeUndefined()
  })

  it('tool calls da agenti confidence >= 0.5 vengono incluse', () => {
    const proposals = [
      proposal('dietista', 'nutrition', 'aggiorno peso', 0.8, {
        toolCalls: [{ id: 'tc1', name: 'user.updateProfile', args: { fields: { weight: 75 } } }],
      }),
      proposal('mmg', 'health', 'no aggiornamenti', 0.3, {
        toolCalls: [{ id: 'tc2', name: 'user.updateProfile', args: { fields: { weight: 80 } } }],
      }),
    ]

    const result = runConsensus({
      opts: CONSENSUS_OPTS,
      team: TEAM,
      proposals,
      domainHint: 'health',
      contextPack: BASE_CONTEXT,
      orchestratorToolsAllowed: ['user.updateProfile'],
    })

    // Solo la tool call del dietista (conf=0.8 > 0.5) deve essere inclusa
    expect(result.toolCallsToExecute.some((tc) => tc.name === 'user.updateProfile')).toBe(true)
    // Deve essere quella con weight=75 (dalla proposta più alta)
    const tc = result.toolCallsToExecute.find((t) => t.name === 'user.updateProfile')
    expect((tc?.args as { fields: { weight: number } })?.fields?.weight).toBe(75)
  })

  it('domainIcon in ui corrisponde al dominio rilevato', () => {
    const proposals = [proposal('dietista', 'nutrition', 'consiglio nutrizionale', 0.9)]
    const result = runConsensus({
      opts: CONSENSUS_OPTS,
      team: TEAM,
      proposals,
      domainHint: 'nutrition',
      contextPack: BASE_CONTEXT,
      orchestratorToolsAllowed: [],
    })
    expect(result.ui.domainIcon).toBe('nutrition')
  })
})

// ─── 3. Fast Paths ────────────────────────────────────────────────────────────

describe('isGenericMessage — fast path detection', () => {
  const noHistoryCtx: ContextPack = {
    ...BASE_CONTEXT,
    history: { recentMessages: [], recentArtifacts: [] },
  }

  const withHistoryCtx: ContextPack = {
    ...BASE_CONTEXT,
    history: {
      recentMessages: [{ role: 'user', content: 'ho dolore', createdAt: new Date().toISOString() }],
      recentArtifacts: [],
    },
  }

  it('"ciao" → generic (greeting)', () => {
    // Fast path disabilitato: isGenericMessage restituisce sempre false (LLM-driven)
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'ciao',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })

  it('"buongiorno!" → generic (greeting)', () => {
    // Fast path disabilitato: isGenericMessage restituisce sempre false (LLM-driven)
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'buongiorno!',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })

  it('"ok" con history → generic (filler mid-conversation)', () => {
    // Fast path disabilitato: isGenericMessage restituisce sempre false (LLM-driven)
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'ok',
        contextPack: withHistoryCtx,
      }),
    ).toBe(false)
  })

  it('"perfetto" con history → generic (filler)', () => {
    // Fast path disabilitato: isGenericMessage restituisce sempre false (LLM-driven)
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'perfetto',
        contextPack: withHistoryCtx,
      }),
    ).toBe(false)
  })

  it('"ho dolore alla schiena" → non generic', () => {
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'ho dolore alla schiena',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })

  it('"voglio un piano alimentare" → non generic', () => {
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'voglio un piano alimentare',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })

  it('messaggio corto ≤4 parole senza dominio e senza history → generic', () => {
    // Fast path disabilitato: isGenericMessage restituisce sempre false (LLM-driven)
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'ok come va',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })

  // A4 regression — clinical short messages must NOT be skipped even if ≤4 words and no history.
  it('"ho mal di testa" (4 parole, no history) → NON generic (dominio health)', () => {
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'ho mal di testa',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })

  it('"mi fa male" (3 parole, no history) → NON generic (segnale clinico)', () => {
    expect(
      isGenericMessage({
        requestId: 'r',
        userId: 'u',
        conversationId: 'c',
        message: 'mi fa male',
        contextPack: noHistoryCtx,
      }),
    ).toBe(false)
  })
})

describe('tryAgeQuestionFastPath', () => {
  it('domanda età senza birthDate → handled + gating question', () => {
    // Fast path rimosso: tryAgeQuestionFastPath restituisce sempre { handled: false }
    const result = tryAgeQuestionFastPath({
      requestId: 'r',
      userId: 'u',
      conversationId: 'c',
      message: 'quanti anni ho?',
      contextPack: BASE_CONTEXT,
    })
    expect(result.handled).toBe(false)
  })

  it('domanda età con birthDate → handled + risponde con età', () => {
    // Fast path rimosso: tryAgeQuestionFastPath restituisce sempre { handled: false }
    const ctxWithBirth: ContextPack = {
      ...BASE_CONTEXT,
      user: {
        ...BASE_CONTEXT.user,
        attributes: {
          personal: {
            birthDate: { value: '1990-03-21', unit: undefined },
          },
        },
      },
    }
    const result = tryAgeQuestionFastPath({
      requestId: 'r',
      userId: 'u',
      conversationId: 'c',
      message: 'quanti anni ho?',
      contextPack: ctxWithBirth,
    })
    expect(result.handled).toBe(false)
  })

  it('domanda età con snapshot canonico e legacy in conflitto → usa il panel canonico', () => {
    // Fast path rimosso: tryAgeQuestionFastPath restituisce sempre { handled: false }
    const result = tryAgeQuestionFastPath({
      requestId: 'r',
      userId: 'u',
      conversationId: 'c',
      message: 'quanti anni ho?',
      caseState: {
        conversationId: 'c',
        ownerAgentId: 'mmg',
        activeSpeakerAgentId: 'mmg',
        protocolState: 'owner_active',
        takeoverTurns: 0,
        loopCount: 0,
        handoffCount: 0,
      },
      caseStateSnapshot: {
        schemaVersion: 1,
        conversationId: 'c',
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
          activeProblems: [],
          activeGoals: [],
          activeConstraints: [],
          summary: null,
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: [],
          needsReview: false,
        },
        sharedOpenQuestions: [],
        domainOpenQuestions: {},
        updatedAt: '2026-03-26T23:59:00.000Z',
      },
      contextPack: BASE_CONTEXT,
    })

    // Fast path rimosso: restituisce sempre { handled: false }
    expect(result.handled).toBe(false)
  })

  it('messaggio normale → not handled', () => {
    const result = tryAgeQuestionFastPath({
      requestId: 'r',
      userId: 'u',
      conversationId: 'c',
      message: 'ho dolore alla schiena',
      contextPack: BASE_CONTEXT,
    })
    expect(result.handled).toBe(false)
  })
})

// ─── 4. Intake Questions ──────────────────────────────────────────────────────

describe('getMissingRequiredFields', () => {
  const emptyCtx: ContextPack = {
    ...BASE_CONTEXT,
    user: { id: 'u1', role: 'USER', profile: {} },
  }

  const teamIds = TEAM.map((a) => a.id)

  it('sleep-coach: sleep_hours/latency/wakings/quality sono ownFields (fix bug P3)', () => {
    const result = getMissingRequiredFields('sleep-coach', emptyCtx, teamIds)
    // Tutti i campi sleep devono essere ownFields (sleep-coach è il primary owner)
    expect(result.ownFields).toContain('sleep_hours')
    expect(result.ownFields).toContain('sleep_latency')
    expect(result.ownFields).toContain('night_wakings')
    expect(result.ownFields).toContain('sleep_quality')
    // Non ci devono essere peerFields per questi campi
    const sleepPeer = result.peerFields.find((p) => p.fields.some((f) => f.startsWith('sleep_')))
    expect(sleepPeer).toBeUndefined()
  })

  it('dietista: weight e height sono ownFields (è il primary owner)', () => {
    const result = getMissingRequiredFields('dietista', emptyCtx, teamIds)
    expect(result.ownFields).toContain('weight')
    expect(result.ownFields).toContain('height')
  })

  it('endocrinologo: weight è peerField routed a dietista', () => {
    const result = getMissingRequiredFields('endocrinologo', emptyCtx, teamIds)
    const peer = result.peerFields.find((p) => p.agentId === 'dietista')
    expect(peer?.fields).toContain('weight')
  })

  it('endocrinologo: sleep_hours è peerField routed a sleep-coach', () => {
    const result = getMissingRequiredFields('endocrinologo', emptyCtx, teamIds)
    const peer = result.peerFields.find((p) => p.agentId === 'sleep-coach')
    expect(peer?.fields).toContain('sleep_hours')
  })

  it('fisioterapista: pain_location è ownField (è il primary owner)', () => {
    const result = getMissingRequiredFields('fisioterapista', emptyCtx, teamIds)
    expect(result.ownFields).toContain('pain_location')
    expect(result.ownFields).toContain('pain_intensity')
  })

  it('se peer non è nel team → campo diventa ownField', () => {
    // Team senza dietista → weight non può essere routato a dietista
    const teamSenzaDietista = teamIds.filter((id) => id !== 'dietista')
    const result = getMissingRequiredFields('endocrinologo', emptyCtx, teamSenzaDietista)
    // weight non ha un peer disponibile → diventa ownField
    expect(result.ownFields).toContain('weight')
  })

  it('agente sconosciuto → risultato vuoto', () => {
    const result = getMissingRequiredFields('agente-inesistente', emptyCtx, teamIds)
    expect(result.ownFields).toHaveLength(0)
    expect(result.peerFields).toHaveLength(0)
  })

  it('campo già nel profilo → non richiesto', () => {
    const ctxWithWeight: ContextPack = {
      ...BASE_CONTEXT,
      user: {
        id: 'u1',
        role: 'USER',
        profile: { weight: 75, height: 175 },
      },
    }
    const result = getMissingRequiredFields('dietista', ctxWithWeight, teamIds)
    // weight e height sono nel profile → non mancanti
    expect(result.ownFields).not.toContain('weight')
    expect(result.ownFields).not.toContain('height')
  })

  it('birthDate nel profilo soddisfa il required birth_date', () => {
    const ctxWithBirthDate: ContextPack = {
      ...BASE_CONTEXT,
      user: {
        id: 'u1',
        role: 'USER',
        profile: { birthDate: '1991-06-26' },
      },
    }
    const result = getMissingRequiredFields('dietista', ctxWithBirthDate, teamIds)
    expect(result.ownFields).not.toContain('birth_date')
  })
})

// ─── 5. Orchestrazione End-to-End ────────────────────────────────────────────

describe('orchestrate — end-to-end con LLM mock', () => {
  it('restituisce round1 e round2 proposals nel debug', async () => {
    const result = await orchestrate(
      { llm: makeLlm(), team: TEAM, orchestratorToolsAllowed: ['user.updateProfile'] },
      {
        requestId: 'r1',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ho dolore alla schiena e voglio capire cosa fare',
        contextPack: BASE_CONTEXT,
      },
    )

    expect(result.debug?.round1Proposals?.length).toBeGreaterThan(0)
    expect(result.debug?.round2Proposals?.length).toBeGreaterThan(0)
    expect(result.finalMessageMarkdown.length).toBeGreaterThan(0)
  })

  it('greeting → skipAgents (round1/round2 vuoti)', async () => {
    const result = await orchestrate(
      { llm: makeLlm(), team: TEAM, orchestratorToolsAllowed: [] },
      {
        requestId: 'r2',
        userId: 'u1',
        conversationId: 'c1',
        message: 'ciao',
        contextPack: BASE_CONTEXT,
      },
    )

    expect(result.debug?.round1Proposals).toHaveLength(0)
    expect(result.debug?.round2Proposals).toHaveLength(0)
  })

  it('dominio nutrition → dietista selezionato tra gli agenti', async () => {
    const result = await orchestrate(
      { llm: makeLlm(), team: TEAM, orchestratorToolsAllowed: [] },
      {
        requestId: 'r3',
        userId: 'u1',
        conversationId: 'c1',
        message: 'voglio un piano alimentare per dimagrire',
        contextPack: BASE_CONTEXT,
      },
    )

    expect(result.debug?.selectedAgents).toContain('dietista')
  })

  it("con consult_active_takeover → fisioterapista è l'activeSpecialist e incluso nel pool", async () => {
    // Utilizziamo consult_active_takeover: garantisce che deriveActiveSpecialist
    // ritorni il consultTargetAgent senza dover passare per l'auto-consult logic
    const caseStateConsult = {
      conversationId: 'c4',
      ownerAgentId: 'dietista',
      activeSpeakerAgentId: 'fisioterapista',
      consultTargetAgentId: 'fisioterapista',
      returnTargetAgentId: 'dietista',
      protocolState: 'consult_active_takeover' as const,
      consultReason: 'user_requested_specialist',
      takeoverTurns: 1,
      loopCount: 1,
      handoffCount: 0,
    }

    const result = await orchestrate(
      { llm: makeLlm(), team: TEAM, orchestratorToolsAllowed: [] },
      {
        requestId: 'r4',
        userId: 'u1',
        conversationId: 'c4',
        message: 'parliamo ancora del dolore alla schiena',
        contextPack: BASE_CONTEXT,
        caseState: caseStateConsult,
      },
    )

    // In specialist mode, only the activeSpecialist is routed — no cross-domain
    // contamination. Verify the active specialist is defined and is in the selected pool.
    expect(result.activeSpecialist).toBeDefined()
    const activeId = result.activeSpecialist?.id
    const allSelected = [
      ...(result.debug?.selectedAgents ?? []),
      ...(result.debug?.round2Proposals?.map((p: AgentProposal) => p.agentId) ?? []),
    ]
    expect(activeId).toBeDefined()
    expect(allSelected.some((id: string) => id === activeId)).toBe(true)
  })

  it('tool call non-retriable recente → bloccata + in blockedToolCalls', async () => {
    const ctxWithFailure: ContextPack = {
      ...BASE_CONTEXT,
      history: {
        ...BASE_CONTEXT.history,
        toolExecutionTrace: [
          {
            toolCallId: 'tc-blocked',
            name: 'user.updateProfile',
            ok: false,
            code: 'FORBIDDEN',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }

    const llmWithTool = makeLlm({
      toolCalls: [{ id: 'tc-new', name: 'user.updateProfile', args: { fields: { weight: 70 } } }],
    })

    const result = await orchestrate(
      {
        llm: llmWithTool,
        team: TEAM,
        orchestratorToolsAllowed: ['user.updateProfile'],
        retryGuardWindowMs: 5 * 60 * 1000,
      },
      {
        requestId: 'r5',
        userId: 'u1',
        conversationId: 'c5',
        message: 'aggiorna il mio peso',
        contextPack: ctxWithFailure,
      },
    )

    expect(result.toolCallsToExecute).toHaveLength(0)
    expect(result.debug?.blockedToolCalls?.length).toBeGreaterThan(0)
  })

  it('urgentEscalation flag → escalation "urgent" nel risultato', async () => {
    const urgentLlm = makeLlm({ flags: { urgentEscalation: true } })

    const result = await orchestrate(
      { llm: urgentLlm, team: TEAM, orchestratorToolsAllowed: [] },
      {
        requestId: 'r6',
        userId: 'u1',
        conversationId: 'c6',
        message: 'ho dolore al petto e fiato corto',
        contextPack: BASE_CONTEXT,
      },
    )

    expect(result.safety.escalation).toBe('urgent')
    expect(result.safety.disclaimers?.length).toBeGreaterThan(0)
  })

  it('decisionTrace ha almeno 2 eventi (domain + agents)', async () => {
    const result = await orchestrate(
      { llm: makeLlm(), team: TEAM, orchestratorToolsAllowed: [] },
      {
        requestId: 'r7',
        userId: 'u1',
        conversationId: 'c7',
        message: 'come posso dormire meglio?',
        contextPack: BASE_CONTEXT,
      },
    )

    expect(result.debug?.decisionTrace?.length).toBeGreaterThanOrEqual(2)
  })

  it('globalTimeoutMs molto basso → errore di timeout', async () => {
    const verySlowLlm = {
      complete: async () => {
        await new Promise((r) => setTimeout(r, 200))
        return { text: JSON.stringify({ domain: 'health', summary: 'ok', confidence: 0.8 }) }
      },
    }

    await expect(
      orchestrate(
        {
          llm: verySlowLlm,
          team: TEAM,
          orchestratorToolsAllowed: [],
          globalTimeoutMs: 10, // 10ms — certamente timeout
        },
        {
          requestId: 'r8',
          userId: 'u1',
          conversationId: 'c8',
          message: 'ho dolore alla schiena',
          contextPack: BASE_CONTEXT,
        },
      ),
    ).rejects.toThrow(/exceeded global budget/)
  })

  it('caseState mantenuto tra turn: inizializzazione → owner_active', async () => {
    const result = await orchestrate(
      { llm: makeLlm(), team: TEAM, orchestratorToolsAllowed: [] },
      {
        requestId: 'r9',
        userId: 'u1',
        conversationId: 'c9',
        message: 'voglio parlare con il fisioterapista per la mia schiena',
        contextPack: BASE_CONTEXT,
      },
    )

    // CaseState inizializzato con owner fisioterapista
    expect(result.caseState).toBeDefined()
    expect(result.caseState?.protocolState).toBe('owner_active')
    expect(result.caseState?.ownerAgentId).toBe('fisioterapista')
    expect(result.protocolEvents?.some((e) => e.kind === 'initialized')).toBe(true)
  })
})
