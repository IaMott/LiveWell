import {
  AgentProfile,
  AgentInput,
  AgentProposal,
  ConsensusResult,
  ContextPack,
  Domain,
  UserAttributes,
} from '../types'
import { detectDomainFromText, detectDomainsMulti } from '../domain/domainDetection'
import { selectAgentsForRequest, runConsensus } from '../consensus/consensusEngine'

export type LlmClient = {
  complete: (args: {
    system: string
    user: string
    jsonSchema?: unknown
    stream?: boolean
    format?: 'json' | 'text'
  }) => Promise<{ text: string }>
}

type AgentMemorySnapshot = {
  agentId: string
  memory: unknown
}

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
  agentMemoryStore?: {
    loadMany: (userId: string, agentIds: string[]) => Promise<AgentMemorySnapshot[]>
    saveMany: (userId: string, snapshots: AgentMemorySnapshot[]) => Promise<void>
  }
}

function formatAttributes(attrs: UserAttributes | undefined): string {
  if (!attrs || Object.keys(attrs).length === 0) return ''

  const lines: string[] = ['DATI UTENTE REGISTRATI:']
  const domainLabels: Record<string, string> = {
    health: 'Salute',
    nutrition: 'Nutrizione',
    training: 'Allenamento',
    mindfulness: 'Benessere mentale',
    personal: 'Dati personali',
    general: 'Generali',
  }

  for (const [domain, entries] of Object.entries(attrs)) {
    if (!entries || typeof entries !== 'object') continue
    const label = domainLabels[domain] ?? domain
    const entryLines: string[] = []
    for (const [key, val] of Object.entries(
      entries as Record<
        string,
        { value: unknown; unit?: string; recordedAt: string; notes?: string }
      >,
    )) {
      const v = typeof val.value === 'object' ? JSON.stringify(val.value) : String(val.value)
      const unit = val.unit ? ` ${val.unit}` : ''
      const date = val.recordedAt ? ` (${val.recordedAt.slice(0, 10)})` : ''
      const notes = val.notes ? ` — ${val.notes}` : ''
      entryLines.push(`  ${key}: ${v}${unit}${date}${notes}`)
    }
    if (entryLines.length > 0) {
      lines.push(`[${label}]`)
      lines.push(...entryLines)
    }
  }

  return lines.join('\n')
}

function stringifyMemory(memory: unknown): string {
  if (!memory) return ''
  if (typeof memory === 'string') return memory
  try {
    return JSON.stringify(memory)
  } catch {
    return ''
  }
}

function buildTeamBoard(proposals: AgentProposal[]): string {
  if (proposals.length === 0) return ''
  const lines: string[] = ['BOARD TEAM (turno corrente):']
  for (const p of proposals) {
    const q = (p.questions ?? []).slice(0, 2).join(' | ')
    lines.push(
      `- ${p.agentId} [domain=${p.domain}, conf=${(p.confidence ?? 0.5).toFixed(2)}] ${p.summary}`,
    )
    if (q) lines.push(`  domande: ${q}`)
  }
  return lines.join('\n')
}

function buildAgentUserPrompt(params: {
  input: AgentInput
  agent: AgentProfile
  memoryText?: string
  teamBoardText?: string
  revisionMode: boolean
}): string {
  const { input, agent, memoryText, teamBoardText, revisionMode } = params

  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ``,
    `CONTEXT (summary):`,
    `- role: ${input.contextPack.user.role}`,
    `- moodScore: ${input.contextPack.ui.moodScore}`,
  ]

  const recentMsgs = input.contextPack.history.recentMessages
  if (recentMsgs.length > 0) {
    parts.push(
      `- recentMessages: ${recentMsgs
        .slice(-6)
        .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
        .join(' | ')}`,
    )
  }

  const crossMsgs = input.contextPack.history.crossConversationMessages
  if (crossMsgs && crossMsgs.length > 0) {
    parts.push(``, `MEMORIA DA SESSIONI PRECEDENTI:`)
    crossMsgs.slice(-8).forEach((m) => {
      parts.push(
        `${m.role === 'user' ? 'Utente' : 'Assistente'} (${m.createdAt.slice(0, 10)}): ${m.content.slice(0, 150)}`,
      )
    })
  }

  const attrsText = formatAttributes(input.contextPack.user.attributes)
  if (attrsText) parts.push('', attrsText)

  if (memoryText) {
    parts.push('', `MEMORIA PERSISTENTE DEL TUO AGENTE:`, memoryText)
  }

  if (teamBoardText && revisionMode) {
    parts.push('', teamBoardText)
    parts.push(
      'RIVEDI la tua proposta considerando gli altri specialisti:',
      '- allinea ciò che è compatibile',
      '- segnala SOLO conflitti clinici/tecnici reali',
      '- evita duplicazioni di domande già coperte da altri agenti.',
    )
  }

  const validTools = agent.toolsAllowed.filter((t) =>
    [
      'user.updateProfile',
      'user.setAttribute',
      'health.addMetric',
      'nutrition.logMeal',
      'nutrition.createFoodItem',
      'nutrition.recipes.createRecipe',
      'training.createWorkoutPlan',
      'training.logWorkoutSession',
      'mindfulness.createEntry',
      'artifacts.saveRecommendation',
      'notifications.createInApp',
      'share.createLink',
      'export.pdf',
      'geo.setPreference',
      'geo.updateCoarseLocation',
      'geo.clearLocation',
    ].includes(t),
  )

  const toolList = Array.from(new Set(['user.setAttribute', 'user.updateProfile', ...validTools]))

  parts.push(
    '',
    `TOOL CALLS DISPONIBILI (puoi proporre questi):`,
    `- user.setAttribute: { domain, key, value, unit?, recordedAt?, validUntil?, notes? }`,
    `  Usa per salvare dati dinamici: peso, diagnosi, farmaci, allergie, infortuni, obiettivi, ecc.`,
    ...toolList
      .filter((t) => t !== 'user.setAttribute' && t !== 'user.updateProfile')
      .map((t) => `- ${t}`),
  )

  parts.push(
    '',
    `ISTRUZIONI:`,
    `- Sei uno specialista. Rispondi SOLO nel tuo dominio di competenza.`,
    `- Se l'utente fornisce nuovi dati, proponi user.setAttribute per salvarli nel database.`,
    `- Fai domande gating solo per dati che il TUO dominio richiede e che non sono già noti.`,
    `- Fornisci raccomandazioni basate su evidenza. Se incerto, dillo.`,
  )

  return parts.join('\n')
}

async function runOneAgent(params: {
  llm: LlmClient
  agent: AgentProfile
  input: AgentInput
  memoryText?: string
  teamBoardText?: string
  revisionMode: boolean
}): Promise<AgentProposal> {
  const { llm, agent, input, memoryText, teamBoardText, revisionMode } = params
  const userPrompt = buildAgentUserPrompt({
    input,
    agent,
    memoryText,
    teamBoardText,
    revisionMode,
  })

  const res = await llm.complete({
    system: agent.systemPrompt,
    user: userPrompt,
  })

  try {
    const obj = JSON.parse(res.text)
    return {
      agentId: agent.id,
      domain: (obj.domain as Domain) ?? input.domainHint ?? 'general',
      summary: String(obj.summary ?? '').slice(0, 600),
      reasoning: String(obj.reasoning ?? '').slice(0, 4000),
      questions: Array.isArray(obj.questions) ? obj.questions.map(String).slice(0, 8) : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
      toolCalls: Array.isArray(obj.toolCalls) ? obj.toolCalls : [],
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.6,
      citations: Array.isArray(obj.citations) ? obj.citations : [],
      flags: obj.flags ?? {},
    }
  } catch {
    return {
      agentId: agent.id,
      domain: input.domainHint ?? 'general',
      summary: res.text.slice(0, 600),
      reasoning: res.text.slice(0, 4000),
      questions: [],
      recommendations: [],
      toolCalls: [],
      confidence: 0.4,
    }
  }
}

async function synthesizeResponse(
  llm: LlmClient,
  params: {
    userMessage: string
    proposals: AgentProposal[]
    gatingQuestions: string[]
    contextPack: ContextPack
  },
): Promise<string> {
  const { userMessage, proposals, gatingQuestions, contextPack } = params

  const summaries = proposals
    .filter((p) => p.summary)
    .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
    .map((p) => p.summary)
    .join('\n')

  const topRecs = proposals
    .flatMap((p) => p.recommendations ?? [])
    .slice(0, 3)
    .map((r) => `• ${r.title}: ${r.steps.slice(0, 2).join('; ')}`)
    .join('\n')

  const recentHistory = contextPack.history.recentMessages
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Utente' : 'LiveWell'}: ${m.content.slice(0, 120)}`)
    .join('\n')

  const systemPrompt = [
    `Sei LiveWell, un assistente per il benessere personale che coordina un team di specialisti italiani.`,
    `Parli in italiano, con tono caldo, diretto e professionale — mai generico.`,
    `REGOLE: niente markdown header, niente frasi di apertura generiche, risposta diretta e concreta.`,
  ].join('\n')

  const userPrompt = [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    '',
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries,
    topRecs ? `\nRACCOMANDAZIONI:\n${topRecs}` : '',
    gatingQuestions.length
      ? `\nINFORMAZIONI ANCORA MANCANTI (chiedi solo la più importante): ${gatingQuestions
          .slice(0, 3)
          .join('; ')}`
      : '',
    '',
    `Scrivi una risposta conversazionale naturale in italiano, rivolta direttamente all'utente.`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const res = await llm.complete({ system: systemPrompt, user: userPrompt, format: 'text' })
    const text = res.text.trim()
    if (text.startsWith('{') || text.startsWith('[')) {
      return proposals.find((p) => p.summary)?.summary ?? 'Il team sta elaborando la tua richiesta.'
    }
    return text
  } catch {
    return proposals.find((p) => p.summary)?.summary ?? 'Il team sta elaborando la tua richiesta.'
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const primaryDomain = input.domainHint ?? detectDomainFromText(input.message)
  const allDetectedDomains = detectDomainsMulti(input.message)
    .filter((d) => d.score > 0)
    .map((d) => d.domain as Domain)

  const selectedAgents = selectAgentsForRequest(deps.team, primaryDomain, 4, allDetectedDomains)
  const selectedAgentIds = selectedAgents.map((a) => a.id)

  const memoryRows = deps.agentMemoryStore
    ? await deps.agentMemoryStore.loadMany(input.userId, selectedAgentIds)
    : []
  const memoryMap = new Map(memoryRows.map((m) => [m.agentId, stringifyMemory(m.memory)]))

  // Round 1: initial specialist proposals
  const initialProposals = await Promise.all(
    selectedAgents.map((agent) =>
      runOneAgent({
        llm: deps.llm,
        agent,
        input: { ...input, domainHint: primaryDomain },
        memoryText: memoryMap.get(agent.id),
        revisionMode: false,
      }),
    ),
  )

  // Round 2: each specialist revises after reading the team board
  const teamBoardText = buildTeamBoard(initialProposals)
  const revisedProposals = await Promise.all(
    selectedAgents.map((agent, idx) =>
      runOneAgent({
        llm: deps.llm,
        agent,
        input: { ...input, domainHint: primaryDomain },
        memoryText: memoryMap.get(agent.id),
        teamBoardText,
        revisionMode: true,
      }).catch(() => initialProposals[idx]),
    ),
  )

  const finalProposals = revisedProposals.map((p, idx) =>
    p.summary?.trim() ? p : initialProposals[idx],
  )

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals: finalProposals,
    domainHint: primaryDomain,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })

  // Persist per-agent memory snapshot for future turns
  if (deps.agentMemoryStore) {
    const snapshots: AgentMemorySnapshot[] = finalProposals.map((p) => ({
      agentId: p.agentId,
      memory: {
        lastDomain: p.domain,
        lastSummary: p.summary,
        openQuestions: (p.questions ?? []).slice(0, 5),
        lastConfidence: p.confidence ?? null,
        updatedAt: new Date().toISOString(),
      },
    }))
    await deps.agentMemoryStore.saveMany(input.userId, snapshots).catch(() => {})
  }

  const naturalResponse = await synthesizeResponse(deps.llm, {
    userMessage: input.message,
    proposals: finalProposals,
    gatingQuestions: consensus.gatingQuestions ?? [],
    contextPack: input.contextPack,
  })

  return { ...consensus, finalMessageMarkdown: naturalResponse }
}
