import { AgentProfile, AgentInput, AgentProposal, ConsensusResult, Domain } from '../types'
import { detectDomainFromText } from '../domain/domainDetection'
import { selectAgentsForRequest, runConsensus } from '../consensus/consensusEngine'

export type LlmClient = {
  complete: (args: {
    system: string
    user: string
    jsonSchema?: unknown
    stream?: boolean
  }) => Promise<{ text: string }>
}

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile serialization — builds a compact but rich context block for agents
// ─────────────────────────────────────────────────────────────────────────────

function formatAge(birthDate: unknown): string | null {
  if (!birthDate || typeof birthDate !== 'string') return null
  try {
    const years = Math.floor(
      (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    )
    return isNaN(years) || years < 0 || years > 120 ? null : `${years}`
  } catch {
    return null
  }
}

function serializeProfileContext(pack: AgentInput['contextPack']): string {
  const profile = pack.user.profile as Record<string, unknown> | undefined
  if (!profile) return ''

  const lines: string[] = []

  // ── Personal ──────────────────────────────────────────────────────────────
  const personal: string[] = []
  const age = formatAge(profile.birthDate)
  if (age) personal.push(`age: ${age}`)
  if (profile.gender) personal.push(`gender: ${profile.gender}`)
  if (profile.height) personal.push(`height: ${profile.height} cm`)
  if (profile.weight) personal.push(`weight: ${profile.weight} kg`)
  if (personal.length > 0) lines.push(`PERSONAL: ${personal.join(', ')}`)

  // ── Health ────────────────────────────────────────────────────────────────
  const health = profile.health as Record<string, unknown> | null | undefined
  if (health && typeof health === 'object') {
    const hParts: string[] = []
    if (health.conditions) hParts.push(`conditions: ${health.conditions}`)
    if (health.medications) hParts.push(`medications: ${health.medications}`)
    if (health.allergies) hParts.push(`allergies: ${health.allergies}`)
    if (health.surgeries) hParts.push(`past surgeries: ${health.surgeries}`)
    if (health.smokingStatus) hParts.push(`smoking: ${health.smokingStatus}`)
    if (hParts.length > 0) lines.push(`HEALTH: ${hParts.join(' | ')}`)
  }

  // ── Nutrition ─────────────────────────────────────────────────────────────
  const nutrition = profile.nutrition as Record<string, unknown> | null | undefined
  if (nutrition && typeof nutrition === 'object') {
    const nParts: string[] = []
    if (nutrition.dietType) nParts.push(`diet: ${nutrition.dietType}`)
    if (nutrition.dailyKcal) nParts.push(`kcal target: ${nutrition.dailyKcal}`)
    if (nutrition.meals) nParts.push(`meals/day: ${nutrition.meals}`)
    if (nutrition.allergies) nParts.push(`intolerances: ${nutrition.allergies}`)
    if (nParts.length > 0) lines.push(`NUTRITION: ${nParts.join(' | ')}`)
  }

  // ── Training ──────────────────────────────────────────────────────────────
  const training = profile.training as Record<string, unknown> | null | undefined
  if (training && typeof training === 'object') {
    const tParts: string[] = []
    if (training.fitnessLevel) tParts.push(`level: ${training.fitnessLevel}`)
    if (training.weeklyDays) tParts.push(`days/week: ${training.weeklyDays}`)
    if (training.preferredActivities) tParts.push(`activities: ${training.preferredActivities}`)
    if (training.trainingGoal) tParts.push(`goal: ${training.trainingGoal}`)
    if (tParts.length > 0) lines.push(`TRAINING: ${tParts.join(' | ')}`)
  }

  // ── Mindfulness ───────────────────────────────────────────────────────────
  const mindfulness = profile.mindfulness as Record<string, unknown> | null | undefined
  if (mindfulness && typeof mindfulness === 'object') {
    const mParts: string[] = []
    if (mindfulness.sleepHours) mParts.push(`sleep target: ${mindfulness.sleepHours}h`)
    if (mindfulness.stressTarget) mParts.push(`stress target: ${mindfulness.stressTarget}/10`)
    if (mindfulness.meditationGoal) mParts.push(`goal: ${mindfulness.meditationGoal}`)
    if (mParts.length > 0) lines.push(`MINDFULNESS: ${mParts.join(' | ')}`)
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  const goals = profile.goals as Record<string, unknown> | null | undefined
  if (goals && typeof goals === 'object') {
    const gParts: string[] = []
    if (goals.primaryGoal) gParts.push(`primary: ${goals.primaryGoal}`)
    if (goals.weightGoal) gParts.push(`weight goal: ${goals.weightGoal} kg`)
    if (gParts.length > 0) lines.push(`GOALS: ${gParts.join(' | ')}`)
  }

  return lines.length > 0 ? `\nUSER PROFILE:\n${lines.join('\n')}` : ''
}

function serializeTrackerContext(pack: AgentInput['contextPack']): string {
  const { trackers } = pack
  if (!trackers || Object.keys(trackers).length === 0) return ''

  const parts: string[] = []
  if (trackers.training?.workoutsCount7d != null)
    parts.push(`workouts last 7d: ${trackers.training.workoutsCount7d}`)
  if (trackers.nutrition?.mealsCount7d != null)
    parts.push(`meals logged last 7d: ${trackers.nutrition.mealsCount7d}`)
  if (trackers.mindfulness?.entriesCount7d != null)
    parts.push(`mindfulness entries last 7d: ${trackers.mindfulness.entriesCount7d}`)
  if (trackers.health?.metricsCount7d != null)
    parts.push(`health metrics last 7d: ${trackers.health.metricsCount7d}`)

  return parts.length > 0 ? `\nRECENT ACTIVITY: ${parts.join(' | ')}` : ''
}

function serializeGeoContext(pack: AgentInput['contextPack']): string {
  const geo = pack.geo
  if (!geo) return ''
  const parts: string[] = []
  if (geo.city) parts.push(geo.city)
  if (geo.region) parts.push(geo.region)
  if (geo.country) parts.push(geo.country)
  if (geo.timezone) parts.push(`tz: ${geo.timezone}`)
  return parts.length > 0 ? `\nLOCATION: ${parts.join(', ')}` : ''
}

// ─────────────────────────────────────────────────────────────────────────────

function buildAgentUserPrompt(input: AgentInput): string {
  const profileCtx = serializeProfileContext(input.contextPack)
  const trackerCtx = serializeTrackerContext(input.contextPack)
  const geoCtx = serializeGeoContext(input.contextPack)

  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ``,
    `CONTEXT SUMMARY:`,
    `- role: ${input.contextPack.user.role}`,
    `- wellbeing score: ${input.contextPack.ui.moodScore}/100`,
  ]

  if (profileCtx) parts.push(profileCtx)
  if (trackerCtx) parts.push(trackerCtx)
  if (geoCtx) parts.push(geoCtx)

  // Recent conversation history (last 6 turns)
  const recentHistory = input.contextPack.history.recentMessages.slice(-6)
  if (recentHistory.length > 0) {
    parts.push(`\nCONVERSATION HISTORY (last ${recentHistory.length} turns):`)
    for (const m of recentHistory) {
      parts.push(`${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}`)
    }
  }

  // Detect if last assistant turn had gating questions → extract profile info
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
      parts.push(`\nPREVIOUS TEAM QUESTIONS (from last turn):`)
      prevQuestions.forEach((q) => parts.push(`- ${q}`))
      parts.push(
        `If the user message answers any of these, include a "user.updateProfile" tool call`,
        `with { fields: { <key>: <value> } } for each extracted value.`,
        `Only include fields you can extract with confidence.`,
      )
    }
  }

  // Personalization instruction
  if (profileCtx) {
    parts.push(
      `\nPERSONALIZATION NOTE:`,
      `Use the USER PROFILE above to tailor your response. Reference specific data (age, conditions, goals, fitness level) when relevant. Do NOT ask for information already present in the profile.`,
    )
  }

  parts.push(
    ``,
    `INSTRUCTIONS:`,
    `- You are a specialist agent. Respond ONLY within your domain scope.`,
    `- Ask gating questions only for data genuinely missing from the profile.`,
    `- Provide evidence-based, personalized recommendations.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
    `- Respond in the same language as the user message (default: Italian).`,
  )

  return parts.join('\n')
}

async function runOneAgent(
  llm: LlmClient,
  agent: AgentProfile,
  input: AgentInput,
): Promise<AgentProposal> {
  const userPrompt = buildAgentUserPrompt(input)

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

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const domainHint = input.domainHint ?? detectDomainFromText(input.message)

  const selectedAgents = selectAgentsForRequest(deps.team, domainHint, 4)
  const proposals = await Promise.all(
    selectedAgents.map((a) => runOneAgent(deps.llm, a, { ...input, domainHint })),
  )

  return runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })
}
