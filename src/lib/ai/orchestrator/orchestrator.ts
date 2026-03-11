import {
  AgentProfile,
  AgentInput,
  AgentProposal,
  ConsensusResult,
  ContextPack,
  Domain,
  ActiveSpecialist,
  ToolCall,
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

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
}

/** Phrases that signal the user wants to speak with a specific specialist */
const REQUEST_VERBS = [
  'parlami con',
  'parla con',
  'voglio parlare con',
  'voglio parlare al',
  'voglio il',
  'voglio la',
  'passami il',
  'passami la',
  'dammi il',
  'fammi parlare con',
  'connettimi con',
  'vorrei parlare con',
  'vorrei il',
  'speak to',
  'talk to',
  'chiedi al',
]

/** Maps keyword → agent id for specialist detection */
const SPECIALIST_KEYWORDS: Record<string, string> = {
  dietista: 'dietista',
  dietitian: 'dietista',
  nutrizionista: 'dietista',
  chef: 'chef',
  cuoco: 'chef',
  endocrinologo: 'endocrinologo',
  endocrinologa: 'endocrinologo',
  'personal trainer': 'persona-trainer',
  'personal-trainer': 'persona-trainer',
  trainer: 'persona-trainer',
  allenatore: 'persona-trainer',
  chinesologo: 'chinesologo',
  chinesiologia: 'chinesologo',
  'medico dello sport': 'medico-dello-sport',
  'medico sport': 'medico-dello-sport',
  fisioterapista: 'fisioterapista',
  fisiatra: 'fisiatra',
  'sleep coach': 'sleep-coach',
  'coach del sonno': 'sleep-coach',
  mmg: 'mmg',
  'medico di base': 'mmg',
  'medico curante': 'mmg',
  'medico generico': 'mmg',
  gastroenterologo: 'gastroenterologo',
  gastro: 'gastroenterologo',
  cardiologo: 'cardiologo',
  cardiologa: 'cardiologo',
  dermatologo: 'dermatologo',
  dermatologa: 'dermatologo',
  psicologo: 'psicologo',
  psicologa: 'psicologo',
  'mental coach': 'mental-coach',
  'mental-coach': 'mental-coach',
  'coach relazionale': 'relationship-coach',
  'relationship coach': 'relationship-coach',
  'analista contesto': 'analista-contesto',
  'financial planner': 'financial-planner',
  'pianificatore finanziario': 'financial-planner',
  commercialista: 'commercialista',
  'career coach': 'career-coach',
  'coach carriera': 'career-coach',
  'executive coach': 'executive-coach',
  'organizzatore di vita': 'life-organizer',
  'life organizer': 'life-organizer',
  'consulente legale': 'consulente-legale',
  avvocato: 'consulente-legale',
}

/**
 * Detects if the user is explicitly requesting a specific specialist.
 * Returns the agent id if found, null otherwise.
 */
function detectSpecialistRequest(message: string, team: AgentProfile[]): string | null {
  const lower = message.toLowerCase()

  // Check specialist keywords in message
  for (const [kw, agentId] of Object.entries(SPECIALIST_KEYWORDS)) {
    if (lower.includes(kw)) {
      if (team.some((a) => a.id === agentId)) return agentId
    }
  }

  // If a request verb is present, also match by agent displayName
  const hasRequestVerb = REQUEST_VERBS.some((v) => lower.includes(v))
  if (hasRequestVerb) {
    for (const agent of team) {
      if (lower.includes(agent.displayName.toLowerCase())) return agent.id
    }
  }

  return null
}

function formatUserAttributes(input: AgentInput): string[] {
  const attrs = input.contextPack.user.attributes
  if (!attrs) return []
  const lines: string[] = []
  for (const [domain, kv] of Object.entries(attrs)) {
    if (!kv || typeof kv !== 'object') continue
    const entries = Object.entries(kv as Record<string, { value: unknown; unit?: string }>)
      .slice(0, 8)
      .map(
        ([k, v]) =>
          `${k}: ${typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)}${v.unit ? ` ${v.unit}` : ''}`,
      )
    if (entries.length > 0) {
      lines.push(`[${domain}] ${entries.join(' | ')}`)
    }
  }
  return lines
}

function buildAgentUserPrompt(input: AgentInput, agentId: string, peerInsights?: string): string {
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

  // Profile data in context
  if (input.contextPack.user.profile && Object.keys(input.contextPack.user.profile).length > 0) {
    const profileSummary = Object.entries(input.contextPack.user.profile)
      .slice(0, 10)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ')
    parts.push(`- userProfile: ${profileSummary}`)
  }

  const attributeLines = formatUserAttributes(input)
  if (attributeLines.length > 0) {
    parts.push(``, `USER ATTRIBUTES (fonte principale dinamica):`, ...attributeLines)
  }

  const ownWorkspace = input.contextPack.history.agentWorkspaces?.find((w) => w.agentId === agentId)
  if (ownWorkspace?.round2Summary) {
    parts.push(``, `WORKSPACE MEMORIA TURNO PRECEDENTE:`, ownWorkspace.round2Summary)
  }

  // Detect previous gating questions → instruct agent to call user.setAttribute if answered
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
        `If the user message answers any of these questions, include a "user.setAttribute" tool call`,
        `in toolCalls[] for each extracted value.`,
        `Prefer user.setAttribute: { domain, key, value, unit?, notes? }.`,
        `Only include fields/attributes you can extract with confidence from the user message.`,
      )
    }
  }

  if (peerInsights) {
    parts.push(
      ``,
      `PEER REVIEW (round 2):`,
      peerInsights,
      `Integra o correggi la tua proposta alla luce dei contributi dei colleghi.`,
    )
  }

  parts.push(
    ``,
    `PROFILE EXTRACTION (MANDATORY):`,
    `If the user mentions ANY personal data (weight, height, age, medical conditions, symptoms,`,
    `goals, diet restrictions, training frequency, medications, allergies, sleep hours, stress level etc.),`,
    `ALWAYS include a "user.setAttribute" tool call in your toolCalls[] with extracted values.`,
    `Use user.updateProfile only for legacy compatibility when needed by profile snapshot.`,
    ``,
    `NATURAL DIALOGUE RULE:`,
    `Termina SEMPRE con una domanda aperta o un invito a continuare la conversazione.`,
    `L'ultima parola è sempre dell'utente — mai tua. Chiedi UNA sola cosa alla volta.`,
    ``,
    `INSTRUCTIONS:`,
    `- You are a specialist agent. Respond ONLY within your domain scope.`,
    `- Ask gating questions only for data YOUR specific domain requires.`,
    `- Provide evidence-based recommendations. If uncertain, say so.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
    `- Output must be valid JSON matching the schema below.`,
    ``,
    `OUTPUT JSON SCHEMA (rispetta esattamente questa struttura):`,
    `{`,
    `  "domain": "nutrizione|allenamento|salute|mindfulness|idee|general",`,
    `  "summary": "risposta diretta in italiano, termina con una domanda",`,
    `  "reasoning": "analisi interna non visibile all'utente",`,
    `  "questions": ["domanda gating se necessario"],`,
    `  "recommendations": [],`,
    `  "toolCalls": [{"id":"uuid","name":"user.setAttribute","args":{"domain":"health","key":"weight","value":80,"unit":"kg"}}],`,
    `  "confidence": 0.8`,
    `}`,
  )

  return parts.join('\n')
}

function normalizeDateToIsoDate(d: Date): string {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDobFromNaturalMessage(message: string): string | null {
  const text = message.toLowerCase().trim()
  const now = new Date()
  const currentYear = now.getUTCFullYear()

  const ensureValid = (day: number, month: number, year: number): string | null => {
    if (year < 1900 || year > currentYear) return null
    if (month < 1 || month > 12) return null
    if (day < 1 || day > 31) return null
    const d = new Date(Date.UTC(year, month - 1, day))
    if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
      return null
    }
    return normalizeDateToIsoDate(d)
  }

  // dd/mm/yyyy | dd-mm-yyyy | dd.mm.yyyy
  const numeric = text.match(/\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{4})\b/)
  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])
    const year = Number(numeric[3])
    const parsed = ensureValid(day, month, year)
    if (parsed) return parsed
  }

  // "26 giugno 1991", "26 giu 1991"
  const monthMap: Record<string, number> = {
    gennaio: 1,
    gen: 1,
    febbraio: 2,
    feb: 2,
    marzo: 3,
    mar: 3,
    aprile: 4,
    apr: 4,
    maggio: 5,
    mag: 5,
    giugno: 6,
    giu: 6,
    luglio: 7,
    lug: 7,
    agosto: 8,
    ago: 8,
    settembre: 9,
    set: 9,
    ottobre: 10,
    ott: 10,
    novembre: 11,
    nov: 11,
    dicembre: 12,
    dic: 12,
  }
  const words = text.match(
    /\b([0-3]?\d)\s+(gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|set|ottobre|ott|novembre|nov|dicembre|dic)\s+(\d{4})\b/,
  )
  if (words) {
    const day = Number(words[1])
    const month = monthMap[words[2]]
    const year = Number(words[3])
    const parsed = ensureValid(day, month, year)
    if (parsed) return parsed
  }

  return null
}

function inferPersonalToolCallsFromMessage(message: string): ToolCall[] {
  const calls: ToolCall[] = []
  const lower = message.toLowerCase()

  const hasBirthSignal =
    lower.includes('sono nato') ||
    lower.includes('sono nata') ||
    lower.includes('data di nascita') ||
    lower.includes('nato il') ||
    lower.includes('nata il')

  if (hasBirthSignal) {
    const dobIso = parseDobFromNaturalMessage(message)
    if (dobIso) {
      calls.push({
        id: crypto.randomUUID(),
        name: 'user.setAttribute',
        args: {
          domain: 'personal',
          key: 'birthDate',
          value: dobIso,
          notes: 'Estratto automaticamente da messaggio naturale utente',
        },
      })
    }
  }

  return calls
}

async function runOneAgent(
  llm: LlmClient,
  agent: AgentProfile,
  input: AgentInput,
  peerInsights?: string,
): Promise<AgentProposal> {
  const userPrompt = buildAgentUserPrompt(input, agent.id, peerInsights)

  const res = await llm.complete({
    system: agent.systemPrompt,
    user: userPrompt,
  })

  try {
    const obj = JSON.parse(res.text)
    const parsedToolCalls = Array.isArray(obj.toolCalls) ? obj.toolCalls : []
    const fallbackToolCalls = inferPersonalToolCallsFromMessage(input.message)
    const toolCalls = parsedToolCalls.length > 0 ? parsedToolCalls : fallbackToolCalls
    return {
      agentId: agent.id,
      domain: (obj.domain as Domain) ?? input.domainHint ?? 'general',
      summary: String(obj.summary ?? '').slice(0, 600),
      reasoning: String(obj.reasoning ?? '').slice(0, 4000),
      questions: Array.isArray(obj.questions) ? obj.questions.map(String).slice(0, 8) : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
      toolCalls,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.6,
      citations: Array.isArray(obj.citations) ? obj.citations : [],
      flags: obj.flags ?? {},
    }
  } catch {
    const fallbackToolCalls = inferPersonalToolCallsFromMessage(input.message)
    return {
      agentId: agent.id,
      domain: input.domainHint ?? 'general',
      summary: res.text.slice(0, 600),
      reasoning: res.text.slice(0, 4000),
      questions: [],
      recommendations: [],
      toolCalls: fallbackToolCalls,
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
    .map((m) => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content.slice(0, 120)}`)
    .join('\n')

  let systemPrompt: string
  if (activeSpecialist) {
    systemPrompt = [
      `Sei ${activeSpecialist.displayName}, specialista del team LiveWell.`,
      `Rispondi in prima persona come ${activeSpecialist.displayName}, con tono professionale e umano, in italiano.`,
      `Stai avendo una conversazione diretta con il tuo paziente/cliente nel tuo ruolo specifico.`,
      ``,
      `REGOLE OBBLIGATORIE:`,
      `- NON usare intestazioni markdown (###, ##, #)`,
      `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
      `- Rispondi come professionista direttamente al paziente/cliente, in prima persona`,
      `- Max 3-4 frasi salvo piani dettagliati esplicitamente richiesti`,
      `- Rimani nel tuo ambito di competenza; per altri ambiti rimanda ai colleghi`,
      `- Per piani o programmi strutturati, usa elenchi numerati senza intestazioni`,
      `- Se mancano dati fondamentali per il tuo ambito, chiedi UNA sola informazione alla volta`,
      `- REGOLA FONDAMENTALE: Termina SEMPRE con una domanda aperta o un invito a rispondere — l'ultima parola è sempre dell'utente, mai tua`,
    ].join('\n')
  } else {
    systemPrompt = [
      `Sei LiveWell, assistente per il benessere personale che coordina un team di specialisti italiani.`,
      `Parli in italiano, con tono caldo, diretto e professionale — mai generico.`,
      ``,
      `REGOLE OBBLIGATORIE:`,
      `- NON usare intestazioni markdown (###, ##, #)`,
      `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
      `- NON scrivere "Il team sta elaborando..." o promesse di risposte future`,
      `- NON dire che la risposta arriverà in 24-48 ore o simili`,
      `- Rispondi SUBITO con informazioni concrete basate sull'analisi del team`,
      `- Max 3-4 frasi salvo piani dettagliati richiesti dall'utente`,
      `- Se devi fare domande, includine al massimo 1, in modo conversazionale`,
      `- Non chiedere informazioni già presenti nel profilo utente`,
      `- Usa il punto fermo, non bullet, per risposte conversazionali brevi`,
      `- Per piani strutturati, usa elenchi numerati senza intestazioni`,
      `- REGOLA FONDAMENTALE: Termina SEMPRE con una domanda aperta o un invito a rispondere — l'ultima parola è sempre dell'utente, mai tua`,
    ].join('\n')
  }

  const userPrompt = [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries || '(nessuna analisi disponibile)',
    topRecs ? `\nRACCOMANDAZIONI:\n${topRecs}` : '',
    gatingQuestions.length
      ? `\nINFORMAZIONI ANCORA MANCANTI (chiedi solo la più importante): ${gatingQuestions.slice(0, 3).join('; ')}`
      : '',
    ``,
    `Scrivi una risposta conversazionale in italiano, rivolta direttamente all'utente.`,
    `Termina SEMPRE con una domanda o un invito — non chiudere mai la conversazione unilateralmente.`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const res = await llm.complete({ system: systemPrompt, user: userPrompt, format: 'text' })
    const text = res.text.trim()
    // Fallback if model accidentally returned JSON
    if (text.startsWith('{') || text.startsWith('[')) {
      return proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
    }
    return text
  } catch {
    return proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const domainHint = input.domainHint ?? detectDomainFromText(input.message)
  const allDomains = detectDomainsMulti(input.message).map((d) => d.domain)

  // Determine active specialist: locked from previous turn OR newly requested this turn
  let activeSpecialist: ActiveSpecialist | undefined
  let lockedAgentId = input.activeSpecialistId ?? null

  if (!lockedAgentId) {
    const detectedId = detectSpecialistRequest(input.message, deps.team)
    if (detectedId) lockedAgentId = detectedId
  }

  if (lockedAgentId) {
    const agent = deps.team.find((a) => a.id === lockedAgentId)
    if (agent) {
      activeSpecialist = {
        id: agent.id,
        displayName: agent.displayName,
        domain: (agent.domainTags[0] ?? domainHint) as Domain,
      }
    }
  }

  const selectedAgents = selectAgentsForRequest(deps.team, domainHint, 4, allDomains, input.message)

  const round1Proposals = await Promise.all(
    selectedAgents.map((a) => runOneAgent(deps.llm, a, { ...input, domainHint })),
  )

  const round2Proposals = await Promise.all(
    selectedAgents.map((agent) => {
      const peerInsights = round1Proposals
        .filter((p) => p.agentId !== agent.id)
        .slice(0, 3)
        .map((p) => `- ${p.agentId}: ${p.summary}`)
        .join('\n')
      return runOneAgent(deps.llm, agent, { ...input, domainHint }, peerInsights || undefined)
    }),
  )

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals: round2Proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })

  const naturalResponse = await synthesizeResponse(deps.llm, {
    userMessage: input.message,
    proposals: round2Proposals,
    gatingQuestions: consensus.gatingQuestions ?? [],
    contextPack: input.contextPack,
    activeSpecialist,
  })

  // Deterministic safeguard: if specialists/LLM fail to emit tool-calls,
  // still persist clearly extractable personal data from user text.
  const fallbackToolCalls = inferPersonalToolCallsFromMessage(input.message)
  const mergedToolCalls = [...(consensus.toolCallsToExecute ?? []), ...fallbackToolCalls]
  const dedupedToolCalls = mergedToolCalls.filter((c, idx, arr) => {
    const key = `${c.name}:${JSON.stringify(c.args)}`
    return arr.findIndex((x) => `${x.name}:${JSON.stringify(x.args)}` === key) === idx
  })

  return {
    ...consensus,
    toolCallsToExecute: dedupedToolCalls,
    finalMessageMarkdown: naturalResponse,
    activeSpecialist,
    debug: {
      selectedAgents: consensus.debug?.selectedAgents ?? selectedAgents.map((a) => a.id),
      conflicts: consensus.debug?.conflicts ?? [],
      proposals: round2Proposals,
      round1Proposals,
      round2Proposals,
    },
  }
}
