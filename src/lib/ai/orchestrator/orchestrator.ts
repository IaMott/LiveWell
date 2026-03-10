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

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
}

/**
 * Format the user's current attributes into a compact string for agent context.
 * Shows the most recent value for each known attribute, organized by domain.
 */
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

function buildAgentUserPrompt(input: AgentInput, agent: AgentProfile): string {
  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ``,
    `CONTEXT (summary):`,
    `- role: ${input.contextPack.user.role}`,
    `- moodScore: ${input.contextPack.ui.moodScore}`,
  ]

  // Current conversation history
  const recentMsgs = input.contextPack.history.recentMessages
  if (recentMsgs.length > 0) {
    parts.push(
      `- recentMessages: ${recentMsgs
        .slice(-6)
        .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
        .join(' | ')}`,
    )
  }

  // Cross-conversation memory (previous sessions)
  const crossMsgs = input.contextPack.history.crossConversationMessages
  if (crossMsgs && crossMsgs.length > 0) {
    parts.push(``, `MEMORIA DA SESSIONI PRECEDENTI:`)
    crossMsgs.slice(-8).forEach((m) => {
      parts.push(
        `${m.role === 'user' ? 'Utente' : 'Assistente'} (${m.createdAt.slice(0, 10)}): ${m.content.slice(0, 150)}`,
      )
    })
  }

  // Dynamic user attributes (time-series data from previous conversations)
  const attrsText = formatAttributes(input.contextPack.user.attributes)
  if (attrsText) {
    parts.push(``, attrsText)
  }

  // Detect if previous assistant turn had questions → instruct agent to extract answers
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
      parts.push(``, `DOMANDE PRECEDENTI DEL TEAM:`)
      prevQuestions.forEach((q) => parts.push(`- ${q}`))
      parts.push(
        `Se il messaggio dell'utente risponde a queste domande, proponi i tool calls appropriati`,
        `per salvare le informazioni raccolte (user.setAttribute o user.updateProfile).`,
      )
    }
  }

  // List tools available to this agent
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

  // user.setAttribute is always available to every agent
  const toolList = Array.from(new Set(['user.setAttribute', 'user.updateProfile', ...validTools]))

  parts.push(
    ``,
    `TOOL CALLS DISPONIBILI (puoi proporre questi):`,
    `- user.setAttribute: { domain, key, value, unit?, recordedAt?, validUntil?, notes? }`,
    `  Usa per salvare QUALSIASI dato dinamico: peso, altezza, diagnosi, farmaci, allergie,`,
    `  infortuni, preferenze alimentari, obiettivi, metriche vitali, ecc.`,
    `  Esempi: { domain:"health", key:"weight", value:80, unit:"kg" }`,
    `          { domain:"health", key:"diagnosis", value:"Ernia L4-L5", notes:"da 2020" }`,
    `          { domain:"health", key:"medication", value:{"name":"Ibuprofene","dose":"400mg"} }`,
    `          { domain:"nutrition", key:"allergy", value:"Penicillina" }`,
    `          { domain:"health", key:"injury", value:"distorsione caviglia dx", validUntil:"2026-04-01" }`,
    ...toolList
      .filter((t) => t !== 'user.setAttribute' && t !== 'user.updateProfile')
      .map((t) => `- ${t}`),
  )

  parts.push(
    ``,
    `ISTRUZIONI:`,
    `- Sei uno specialista. Rispondi SOLO nel tuo dominio di competenza.`,
    `- Se l'utente fornisce nuovi dati (peso, sintomi, diagnosi, farmaci, allergie, obiettivi, ecc.)`,
    `  proponi SEMPRE un tool call user.setAttribute per salvarli nel database.`,
    `- Fai domande gating solo per dati che il TUO dominio richiede e che non sono già noti.`,
    `- Fornisci raccomandazioni basate su evidenza. Se incerto, dillo.`,
    `- Non proporre tool calls di altri domini (enforcement è centralizzato).`,
  )

  return parts.join('\n')
}

async function runOneAgent(
  llm: LlmClient,
  agent: AgentProfile,
  input: AgentInput,
): Promise<AgentProposal> {
  const userPrompt = buildAgentUserPrompt(input, agent)

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

/**
 * Final synthesis step: converts structured specialist proposals into a natural,
 * warm Italian conversational response shown to the user.
 */
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
    ``,
    `REGOLE OBBLIGATORIE:`,
    `- NON usare intestazioni markdown (###, ##, #)`,
    `- NON iniziare con "Certo!", "Assolutamente!", "Ottima domanda!" o simili`,
    `- NON ripetere formalmente il dominio (non scrivere "Nell'ambito della nutrizione...")`,
    `- Rispondi direttamente al messaggio dell'utente`,
    `- Max 3-4 frasi salvo piani dettagliati richiesti dall'utente`,
    `- Se devi fare domande, includine al massimo 1, formulata in modo conversazionale`,
    `- Non chiedere informazioni già presenti nel profilo utente`,
    `- Usa il punto fermo, non liste di bullet, per risposte conversazionali brevi`,
    `- Per piani o programmi strutturati, usa elenchi numerati senza intestazioni`,
  ].join('\n')

  const userPrompt = [
    recentHistory ? `CONVERSAZIONE RECENTE:\n${recentHistory}\n` : '',
    `MESSAGGIO UTENTE: "${userMessage}"`,
    ``,
    `ANALISI DEL TEAM SPECIALISTICO:`,
    summaries,
    topRecs ? `\nRACCOMANDAZIONI:\n${topRecs}` : '',
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
    return proposals.find((p) => p.summary)?.summary ?? 'Il team sta elaborando la tua richiesta.'
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  // Detect primary domain + all relevant domains for multi-domain agent selection
  const primaryDomain = input.domainHint ?? detectDomainFromText(input.message)
  const allDetectedDomains = detectDomainsMulti(input.message)
    .filter((d) => d.score > 0)
    .map((d) => d.domain as Domain)

  // Select agents using multi-domain relevance scoring (fixes Problem 1)
  const selectedAgents = selectAgentsForRequest(deps.team, primaryDomain, 4, allDetectedDomains)

  const proposals = await Promise.all(
    selectedAgents.map((a) => runOneAgent(deps.llm, a, { ...input, domainHint: primaryDomain })),
  )

  const consensus = runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals,
    domainHint: primaryDomain,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })

  const naturalResponse = await synthesizeResponse(deps.llm, {
    userMessage: input.message,
    proposals,
    gatingQuestions: consensus.gatingQuestions ?? [],
    contextPack: input.contextPack,
  })

  return { ...consensus, finalMessageMarkdown: naturalResponse }
}
