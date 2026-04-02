import { AgentInput, AgentProfile, AgentProposal, Domain } from '../types'
import { executeAgent, LlmClient } from './agentExecution'

export const AGENT_TIMEOUT_MS = 8_000

/** Max agenti totali (iniziali + espansioni dinamiche) */
export const MAX_TOTAL_AGENTS = 6

/** Max fasi di peer-review oltre il briefing iniziale */
const MAX_PEER_REVIEW_PHASES = 2

export type ExecuteAgentRoundsParams = {
  llm: LlmClient
  selectedAgents: AgentProfile[]
  input: AgentInput
  domainHint: Domain
  timeoutMs?: number
  /** Roster completo del team — necessario per espansione dinamica */
  fullTeam?: AgentProfile[]
  /** Callback per progress events in tempo reale */
  onProgress?: (agentId: string, phase: string, thought: string, displayName: string) => void
}

export type AgentRoundExecutionResult = {
  /** Fase 1 (Briefing): analisi indipendenti */
  round1Proposals: AgentProposal[]
  /** Fase finale (miglior peer-review disponibile) */
  round2Proposals: AgentProposal[]
  /** IDs agenti aggiunti dinamicamente */
  expandedAgentIds?: string[]
  /** IDs agenti ritirati per bassa confidenza (analisi precedenti mantenute) */
  retiredAgentIds?: string[]
  /** Tutte le proposte per fase — per trace completo nel frontend */
  allPhaseProposals?: AgentProposal[][]
}

function withTimeout<T>(promise: Promise<T>, ms: number, agentId: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Agent ${agentId} timed out after ${ms}ms`)), ms),
  )
  return Promise.race([promise, timeout])
}

function buildFallbackProposal(agentId: string, domainHint: Domain, reason: string): AgentProposal {
  return {
    agentId,
    domain: domainHint,
    summary: `[Unavailable] Agent ${agentId} could not respond: ${reason}`,
    reasoning: '',
    questions: [],
    recommendations: [],
    toolCalls: [],
    confidence: 0,
  }
}

/**
 * Costruisce peer insights RICCHI per un agente.
 * Passa il ragionamento completo, le raccomandazioni e le domande aperte
 * di tutti gli altri agenti. Questo permette vera integrazione inter-specialistica.
 */
function buildRichPeerInsights(
  agentId: string,
  accumulatedProposals: AgentProposal[],
  phaseNumber: number,
): string | undefined {
  const peers = accumulatedProposals
    .filter((p) => p.agentId !== agentId && (p.confidence ?? 0) > 0.05)
    // Ordina per rilevanza: confidence più alta prima, poi ha suggestedConsultants
    .sort((a, b) => {
      const aHasSuggested = (a.suggestedConsultants?.length ?? 0) > 0 ? 1 : 0
      const bHasSuggested = (b.suggestedConsultants?.length ?? 0) > 0 ? 1 : 0
      const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0)
      if (Math.abs(confDiff) > 0.1) return confDiff
      return bHasSuggested - aHasSuggested
    })
    .slice(0, 4) // max 4 peer per evitare token explosion

  if (peers.length === 0) return undefined

  const lines: string[] = [
    `=== ANALISI DEI COLLEGHI SPECIALISTI (Fase ${phaseNumber}) ===`,
    `Leggi attentamente le analisi dei tuoi colleghi e integra le loro osservazioni nel tuo ragionamento.`,
    `Segnala accordi, disaccordi o integrazioni rispetto alle loro conclusioni.`,
    ``,
  ]

  for (const peer of peers) {
    lines.push(
      `### ${peer.agentId.toUpperCase()} — dominio: ${peer.domain} | certezza: ${Math.round((peer.confidence ?? 0) * 100)}%`,
    )

    if (peer.reasoning && peer.reasoning.trim().length > 10) {
      lines.push(`**Ragionamento clinico:**`)
      // Cap a 700 char per non saturare il contesto
      lines.push(peer.reasoning.slice(0, 700).replace(/\n{3,}/g, '\n\n'))
    } else if (peer.summary) {
      lines.push(`**Sintesi:** ${peer.summary.slice(0, 400)}`)
    }

    if (peer.recommendations && peer.recommendations.length > 0) {
      lines.push(`**Raccomandazioni principali:**`)
      for (const rec of peer.recommendations.slice(0, 3)) {
        const recText =
          typeof rec === 'string'
            ? rec
            : String(
                (rec as Record<string, unknown>).title ??
                  (rec as Record<string, unknown>).description ??
                  JSON.stringify(rec),
              )
        lines.push(`  - ${recText.slice(0, 200)}`)
      }
    }

    if (peer.questions && peer.questions.length > 0) {
      lines.push(`**Domande ancora aperte:**`)
      for (const q of peer.questions.slice(0, 2)) {
        lines.push(`  - ${q}`)
      }
    }

    if (peer.suggestedConsultants && peer.suggestedConsultants.length > 0) {
      lines.push(`**Suggerisce di coinvolgere:** ${peer.suggestedConsultants.join(', ')}`)
    }

    lines.push(``)
  }

  lines.push(`---`)
  lines.push(
    `Sulla base di quanto sopra, aggiorna la tua analisi integrando le osservazioni dei colleghi.`,
  )

  return lines.join('\n')
}

/**
 * Raccoglie IDs agenti suggeriti da proposte con sufficiente confidenza.
 */
function collectSuggestedAgentIds(
  proposals: AgentProposal[],
  existingIds: Set<string>,
  minConfidence = 0.3,
): string[] {
  const suggested = new Set<string>()
  for (const p of proposals) {
    if ((p.confidence ?? 0) < minConfidence) continue
    for (const id of p.suggestedConsultants ?? []) {
      if (!existingIds.has(id)) suggested.add(id)
    }
  }
  return [...suggested]
}

/**
 * Valuta se è necessaria un'ulteriore fase di peer review.
 * Ritorna false (skip) quando:
 * - meno di 2 agenti attivi con proposte significative
 * - tutti gli agenti hanno alta confidenza E spread basso E nessuno suggerisce consulti
 */
function needsPeerReview(proposals: AgentProposal[], activeAgentCount: number): boolean {
  const meaningful = proposals.filter((p) => (p.confidence ?? 0) > 0.1)
  if (meaningful.length <= 1 || activeAgentCount <= 1) return false

  const confidences = meaningful.map((p) => p.confidence ?? 0)
  const minConf = Math.min(...confidences)
  const maxConf = Math.max(...confidences)
  const allHighConf = minConf >= 0.72
  const smallSpread = maxConf - minConf <= 0.18
  const hasSuggestions = meaningful.some((p) => (p.suggestedConsultants?.length ?? 0) > 0)
  const hasLowConf = meaningful.some((p) => (p.confidence ?? 0) < 0.5)

  if (hasLowConf || hasSuggestions) return true
  if (allHighConf && smallSpread) return false
  return true
}

/**
 * Esegue il pipeline multi-fase di consultazione tra agenti.
 *
 * Fase 1 (Briefing): tutti gli agenti analizzano il caso indipendentemente.
 * Fase 2+ (Peer Review): ogni agente legge l'analisi COMPLETA dei colleghi e aggiorna la propria.
 *   - Espansione dinamica: nuovi agenti possono essere aggiunti in base ai suggerimenti dei colleghi.
 *   - Ritiro dinamico: agenti con confidenza molto bassa vengono ritirati (ma le loro analisi precedenti restano).
 *   - Fase 3: se vengono aggiunti nuovi agenti, si esegue un'ulteriore fase di integrazione.
 *   - Cap: max MAX_TOTAL_AGENTS agenti e MAX_PEER_REVIEW_PHASES fasi di peer-review.
 */
export async function executeAgentRounds(
  params: ExecuteAgentRoundsParams,
): Promise<AgentRoundExecutionResult> {
  const { llm, selectedAgents, input, domainHint, onProgress } = params
  const timeoutMs = params.timeoutMs ?? AGENT_TIMEOUT_MS
  const executionInput = { ...input, domainHint }
  const fullTeam = params.fullTeam ?? []

  const allPhaseProposals: AgentProposal[][] = []
  let activeAgents = [...selectedAgents]
  const expandedAgentIds: string[] = []
  const retiredAgentIds: string[] = []
  const existingIds = new Set(activeAgents.map((a) => a.id))

  // Accumula TUTTE le proposte di tutte le fasi per peer insights ricchi
  let allAccumulatedProposals: AgentProposal[] = []

  // Traccia quale fase è la "prima apparizione" di ciascun agente.
  // Gli agenti aggiunti dinamicamente ricevono un briefing autonomo (senza peer insights)
  // nella loro prima apparizione, esattamente come gli agenti originali in Fase 1.
  const agentFirstPhase = new Map<string, number>()
  for (const agent of activeAgents) {
    agentFirstPhase.set(agent.id, 1)
  }

  // ─── Fase 1: Briefing — analisi indipendenti ─────────────────────────────────
  for (const agent of activeAgents) {
    onProgress?.(agent.id, 'analyzing', 'Briefing · Analisi autonoma del caso', agent.displayName)
  }

  const phase1Results = await Promise.allSettled(
    activeAgents.map((agent) =>
      withTimeout(
        executeAgent({ llm, agent, input: executionInput, domainHint }),
        timeoutMs,
        agent.id,
      ),
    ),
  )

  const phase1Proposals: AgentProposal[] = phase1Results.map((result, i) => {
    const agent = activeAgents[i]!
    if (result.status === 'fulfilled') return result.value
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.warn(`[agentRoundExecution] Fase 1 agente ${agent.id} fallito: ${reason}`)
    return buildFallbackProposal(agent.id, domainHint, reason)
  })

  allPhaseProposals.push(phase1Proposals)
  allAccumulatedProposals = [...phase1Proposals]

  // Emetti eventi di progresso per Fase 1 (reasoning reale, non generico)
  for (const proposal of phase1Proposals) {
    if ((proposal.confidence ?? 0) > 0.3 && proposal.reasoning && proposal.reasoning.length > 5) {
      const agent = activeAgents.find((a) => a.id === proposal.agentId)
      if (agent) {
        onProgress?.(
          agent.id,
          'analyzing',
          `Fase 1 · ${proposal.reasoning.replace(/\n/g, ' ').slice(0, 500)}`,
          agent.displayName,
        )
      }
    }
  }

  // Espansione dinamica dopo Fase 1: agenti suggeriti dai colleghi
  const phase1Suggested = collectSuggestedAgentIds(phase1Proposals, existingIds)
  const slotsAfterPhase1 = MAX_TOTAL_AGENTS - activeAgents.length
  for (const id of phase1Suggested) {
    if (expandedAgentIds.length >= slotsAfterPhase1) break
    const agent = fullTeam.find((a) => a.id === id)
    if (agent) {
      expandedAgentIds.push(id)
      activeAgents = [...activeAgents, agent]
      existingIds.add(id)
      // Registra la prima fase di apparizione per questo agente (farà briefing autonomo)
      agentFirstPhase.set(id, 2)
      onProgress?.(
        id,
        'analyzing',
        `Nuovo specialista · ${agent.displayName} — briefing autonomo`,
        agent.displayName,
      )
      console.info(`[agentRoundExecution] Espansione Fase 1→2: aggiunto ${id}`)
    }
  }

  // ─── Fasi di Peer Review ──────────────────────────────────────────────────────
  let finalProposals = phase1Proposals

  for (let phase = 2; phase <= 1 + MAX_PEER_REVIEW_PHASES; phase++) {
    // Agenti attivi in questa fase (esclusi i ritirati)
    const phaseAgents = activeAgents.filter((a) => !retiredAgentIds.includes(a.id))

    // Skip this peer review phase if consensus is already strong
    if (phase > 1) {
      const prevPhaseProposals = allPhaseProposals[allPhaseProposals.length - 1] ?? []
      if (!needsPeerReview(prevPhaseProposals, phaseAgents.length)) {
        console.info(
          `[agentRoundExecution] Fase ${phase}: peer review skippata (consenso sufficiente)`,
        )
        break
      }
    }

    // Timeout adattivo per le fasi di peer review: con molti agenti e più fasi, il timeout
    // fisso di 8s per agente può saturare il budget globale di 30s.
    // Budget disponibile: 30s totali - ~5s overhead, distribuito su (MAX_PEER_REVIEW_PHASES + 1) fasi.
    const agentCount = phaseAgents.length
    const adaptiveTimeout = Math.max(
      3000,
      Math.min(
        AGENT_TIMEOUT_MS,
        Math.floor(25000 / (MAX_PEER_REVIEW_PHASES + 1) / Math.max(1, agentCount)),
      ),
    )

    if (phaseAgents.length === 0) break

    // Emetti evento peer-review
    if (phaseAgents.length > 1) {
      const primary = phaseAgents[0]!
      onProgress?.(primary.id, 'peer-review', 'Confronto tra specialisti', primary.displayName)
    }

    const phaseResults = await Promise.allSettled(
      phaseAgents.map((agent) => {
        // Se confidenza=0 in fase precedente e non è espanso, non ritentare
        const prevProposal = allAccumulatedProposals.find((p) => p.agentId === agent.id)
        const isOriginal = selectedAgents.some((a) => a.id === agent.id)
        if (prevProposal && prevProposal.confidence === 0 && isOriginal && phase === 2) {
          return Promise.resolve(prevProposal)
        }

        // PUNTO 2 FIX: agenti aggiunti dinamicamente eseguono un briefing autonomo
        // nella loro PRIMA fase di apparizione (senza peer insights).
        // Solo dalla fase successiva partecipano al peer review con i contributi dei colleghi.
        const firstPhase = agentFirstPhase.get(agent.id) ?? 1
        const isFirstAppearance =
          phase === firstPhase || !allAccumulatedProposals.some((p) => p.agentId === agent.id)

        const peerInsights = isFirstAppearance
          ? undefined // Briefing autonomo: analisi indipendente senza influenze esterne
          : buildRichPeerInsights(agent.id, allAccumulatedProposals, phase - 1)

        return withTimeout(
          executeAgent({ llm, agent, input: executionInput, domainHint, peerInsights }),
          adaptiveTimeout,
          agent.id,
        )
      }),
    )

    const phaseProposals: AgentProposal[] = phaseResults.map((result, i) => {
      const agent = phaseAgents[i]!
      if (result.status === 'fulfilled') return result.value
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.warn(`[agentRoundExecution] Fase ${phase} agente ${agent.id} fallito: ${reason}`)
      // Fallback: usa proposta della fase precedente se disponibile
      return (
        allAccumulatedProposals.find((p) => p.agentId === agent.id) ??
        buildFallbackProposal(agent.id, domainHint, reason)
      )
    })

    allPhaseProposals.push(phaseProposals)
    allAccumulatedProposals = [...allAccumulatedProposals, ...phaseProposals]
    finalProposals = phaseProposals

    // Emetti reasoning events per questa fase con etichetta
    for (const proposal of phaseProposals) {
      if ((proposal.confidence ?? 0) > 0.3 && proposal.reasoning && proposal.reasoning.length > 5) {
        const agent = phaseAgents.find((a) => a.id === proposal.agentId)
        if (agent) {
          const firstPhase = agentFirstPhase.get(agent.id) ?? 1
          const isThisAgentsBriefing = phase === firstPhase
          const phaseLabel = isThisAgentsBriefing
            ? `Fase ${phase} · Briefing`
            : `Fase ${phase} · Peer Review`
          onProgress?.(
            agent.id,
            isThisAgentsBriefing ? 'analyzing' : 'peer-review',
            `${phaseLabel} · ${proposal.reasoning.replace(/\n/g, ' ').slice(0, 500)}`,
            agent.displayName,
          )
        }
      }
    }

    // Ritira agenti espansi con confidenza molto bassa dopo peer review
    for (const proposal of phaseProposals) {
      if (
        (proposal.confidence ?? 0) <= 0.05 &&
        expandedAgentIds.includes(proposal.agentId) &&
        !retiredAgentIds.includes(proposal.agentId)
      ) {
        retiredAgentIds.push(proposal.agentId)
        console.info(
          `[agentRoundExecution] Ritiro agente ${proposal.agentId} (confidence: ${proposal.confidence})`,
        )
      }
    }

    // Espansione dinamica per la fase successiva
    if (phase < 1 + MAX_PEER_REVIEW_PHASES) {
      const phaseSuggested = collectSuggestedAgentIds(phaseProposals, existingIds)
      const slotsAvailable = MAX_TOTAL_AGENTS - activeAgents.length
      for (const id of phaseSuggested) {
        if (expandedAgentIds.length >= MAX_TOTAL_AGENTS - selectedAgents.length) break
        if (slotsAvailable <= 0) break
        const agent = fullTeam.find((a) => a.id === id)
        if (agent) {
          expandedAgentIds.push(id)
          activeAgents = [...activeAgents, agent]
          existingIds.add(id)
          // Il nuovo agente farà briefing autonomo nella prossima fase
          agentFirstPhase.set(id, phase + 1)
          onProgress?.(
            id,
            'analyzing',
            `Nuovo specialista · ${agent.displayName} — briefing autonomo in arrivo`,
            agent.displayName,
          )
          console.info(
            `[agentRoundExecution] Espansione Fase ${phase}→${phase + 1}: aggiunto ${id}`,
          )
        }
      }
    }
  }

  return {
    round1Proposals: phase1Proposals,
    round2Proposals: finalProposals,
    expandedAgentIds,
    retiredAgentIds,
    allPhaseProposals,
  }
}
