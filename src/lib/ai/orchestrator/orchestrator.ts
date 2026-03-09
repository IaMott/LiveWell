import { AgentProfile, AgentInput, AgentProposal, ConsensusResult, ContextPack, Domain, ActiveSpecialist } from '../types'
import { detectDomainFromText } from '../domain/domainDetection'
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

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
}

// ── Specialist request detection ──────────────────────────────────────────────

const SPECIALIST_KEYWORDS: Record<string, string[]> = {
  'dietista':          ['dietista', 'nutrizionista', 'alimentazione', 'dieta', 'nutri'],
  'persona-trainer':   ['personal trainer', 'trainer', 'allenatore', 'allenamento', 'palestra', 'fitness'],
  'medico':            ['medico', 'dottore', 'fisiatra', 'salute', 'clinico'],
  'psicologo':         ['psicologo', 'mental coach', 'coach mentale', 'mente', 'mindfulness', 'psico'],
  'chef':              ['chef', 'cuoco', 'ricetta', 'cucina'],
}

const REQUEST_VERBS = [
  'voglio parlare con',
  'posso parlare con',
  'mi colleghi con',
  'chiamami',
  'passa a',
  'fammi parlare con',
  'vorrei parlare con',
  'parla con',
  'speak with',
  'talk to',
]

function detectSpecialistRequest(message: string, team: AgentProfile[]): AgentProfile | null {
  const lower = message.toLowerCase()
  const hasRequestVerb = REQUEST_VERBS.some((v) => lower.includes(v))
  if (!hasRequestVerb) return null

  for (const [agentId, keywords] of Object.entries(SPECIALIST_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const agent = team.find((a) => a.id === agentId)
      if (agent) return agent
      // Fallback: find agent in same domain
      const domain = agentId === 'dietista' || agentId === 'chef'
        ? 'nutrition'
        : agentId === 'persona-trainer'
          ? 'training'
          : agentId === 'medico'
            ? 'health'
            : 'mindfulness'
      return team.find((a) => a.domainTags.includes(domain)) ?? null
    }
  }
  return null
}

// ── Agent prompt builder ───────────────────────────────────────────────────────

function buildAgentUserPrompt(input: AgentInput): string {
  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ``,
    `CONTEXT (summary):`,
    `- role: ${input.contextPack.user.role}`,
    `- moodScore: ${input.contextPack.ui.moodScore}`,
    `- recentMessages: ${input.contextPack.history.recentMessages
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join(' | ')}`,
  ]

  const lastAssistant = input.contextPack.history.recentMessages
    .filter((m) => m.role === 'assistant')
    .slice(-1)[0]
  if (lastAssistant) {
    const prevQuestions = lastAssistant.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.endsWith('?'))
      .slice(0, 6)
    if (prevQuestions.length > 0) {
      parts.push(``, `PREVIOUS TEAM QUESTIONS (from last turn):`)
      prevQuestions.forEach((q) => parts.push(`- ${q}`))
      parts.push(
        `If the user message answers any of these questions, include a "user.updateProfile" tool call`,
        `in your toolCalls[] with { fields: { <key>: <value> } } for each extracted value.`,
        `Only include fields you can extract with confidence from the user message.`,
      )
    }
  }

  parts.push(
    ``,
    `INSTRUCTIONS:`,
    `- You are a specialist agent. Respond ONLY within your domain scope.`,
    `- Ask gating questions only for data that YOUR specific domain requires.`,
    `- Provide evidence-based recommendations. If uncertain, say so.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
    `- Return ONLY valid JSON matching the AgentProposal schema. No markdown outside the JSON object.`,
  )

  return parts.join('\n')
}

async function runOneAgent(
  llm: LlmClient,
  agent: AgentProfile,
  input: AgentInput,
): Promise<AgentProposal> {
  const userPrompt = buildAgentUserPrompt(input)

  // Inject exact allowed tool names to prevent LLM hallucination
  let systemPrompt = agent.systemPrompt
  if (agent.toolsAllowed.length > 0) {
    systemPrompt += [
      '',
      '## STRUMENTI DISPONIBILI',
      'Usa ESATTAMENTE questi nomi in toolCalls[].name (nessuna variazione):',
      agent.toolsAllowed.map((t) => `- ${t}`).join('\n'),
      'Non inventare nomi alternativi. Se un tool non è in questa lista, non includerlo in toolCalls.',
    ].join('\n')
  } else {
    systemPrompt += '\n\n## Strumenti: nessuno disponibile. Non includere toolCalls nel JSON.'
  }

  const res = await llm.complete({ system: systemPrompt, user: userPrompt })

  try {
    const raw = res.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const obj = JSON.parse(raw)
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

// ── Synthesis ─────────────────────────────────────────────────────────────────

async function synthesizeResponse(
  llm: LlmClient,
  params: {
    userMessage: string
    proposals: AgentProposal[]
    gatingQuestions: string[]
    contextPack: ContextPack
    activeSpecialist?: ActiveSpecialist
  },
): Promise<string> {
  const { userMessage, proposals, gatingQuestions, contextPack, activeSpecialist } = params

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

  // Peer proposals from other specialists (to inform the active specialist)
  const peerInsights = activeSpecialist
    ? proposals
        .filter((p) => p.agentId !== activeSpecialist.id)
        .map((p) => `[${p.agentId}]: ${p.summary}`)
        .join('\n')
    : ''

  const systemPrompt = activeSpecialist
    ? [
        `Sei ${activeSpecialist.displayName}, uno specialista del team LiveWell.`,
        `L'utente ha richiesto di parlare direttamente con te. Rispondi in prima persona con la tua voce professionale.`,
        `Prima di rispondere hai consultato i tuoi colleghi specialisti — integra le loro prospettive quando utile.`,
        ``,
        `REGOLE OBBLIGATORIE:`,
        `- Parla in prima persona (es. "Come tuo ${activeSpecialist.displayName}, ti consiglio...")`,
        `- NON usare intestazioni markdown (###, ##, #)`,
        `- NON iniziare con "Certo!", "Assolutamente!" o simili`,
        `- Rispondi direttamente al messaggio dell'utente`,
        `- Max 3-4 frasi salvo piani dettagliati richiesti`,
        `- Se devi fare domande, includine al massimo 1`,
        `- Non chiedere informazioni già presenti nel profilo utente`,
        `- NON menzionare errori tecnici o problemi di sistema`,
        `- Puoi citare i colleghi quando la loro prospettiva arricchisce la risposta`,
      ].join('\n')
    : [
        `Sei LiveWell, un assistente per il benessere personale che coordina un team di specialisti italiani.`,
        `Parli in italiano, con tono caldo, diretto e professionale — mai generico.`,
        ``,
        `REGOLE OBBLIGATORIE:`,
        `- NON usare intestazioni markdown (###, ##, #)`,
        `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
        `- NON ripetere formalmente il dominio`,
        `- Rispondi direttamente al messaggio dell'utente`,
        `- Max 3-4 frasi salvo piani dettagliati richiesti dall'utente`,
        `- Se devi fare domande, includine al massimo 1, formulata in modo conversazionale`,
        `- Non chiedere informazioni già presenti nel profilo utente`,
        `- Usa il punto fermo, non liste di bullet, per risposte conversazionali brevi`,
        `- Per piani o programmi strutturati, usa elenchi numerati senza intestazioni`,
        `- NON menzionare errori tecnici o problemi di sistema`,
      ].join('\n')

  const userPrompt = [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries,
    topRecs ? `\nRACCOMANDAZIONI:\n${topRecs}` : '',
    activeSpecialist && peerInsights ? `\nPROSPETTIVE COLLEGHI (uso interno):\n${peerInsights}` : '',
    gatingQuestions.length
      ? `\nINFORMAZIONI ANCORA MANCANTI (chiedi solo la più importante): ${gatingQuestions.slice(0, 3).join('; ')}`
      : '',
    ``,
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
    return (
      proposals.find((p) => p.summary)?.summary ??
      'Il team sta elaborando la tua richiesta.'
    )
  }
}

// ── Main orchestrate ───────────────────────────────────────────────────────────

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const domainHint = input.domainHint ?? detectDomainFromText(input.message)

  // Detect if user is requesting a specific specialist
  const requestedSpecialist = detectSpecialistRequest(input.message, deps.team)
  const activeSpecialistAgent = requestedSpecialist ?? (
    input.activeSpecialistId
      ? deps.team.find((a) => a.id === input.activeSpecialistId) ?? null
      : null
  )

  const activeSpecialist: ActiveSpecialist | undefined = activeSpecialistAgent
    ? {
        id: activeSpecialistAgent.id,
        displayName: activeSpecialistAgent.displayName,
        domain: (activeSpecialistAgent.domainTags[0] as Domain) ?? domainHint,
      }
    : undefined

  const selectedAgents = selectAgentsForRequest(deps.team, domainHint, 4)

  // Always run all agents (peer consultation rule)
  const proposals = await Promise.all(
    selectedAgents.map((a) => runOneAgent(deps.llm, a, { ...input, domainHint })),
  )

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })

  const naturalResponse = await synthesizeResponse(deps.llm, {
    userMessage: input.message,
    proposals,
    gatingQuestions: consensus.gatingQuestions ?? [],
    contextPack: input.contextPack,
    activeSpecialist,
  })

  return { ...consensus, finalMessageMarkdown: naturalResponse, activeSpecialist }
}
