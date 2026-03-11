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
    `Non fare domande se puoi già rispondere in modo concreto.`,
    `Se manca un dato critico, fai al massimo UNA domanda mirata e solo su quel dato.`,
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

function ageFromIsoDate(isoDate: string): number | null {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 ? age : null
}

function isAgeQuestion(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('quanti anni') ||
    lower.includes('quanti anni ho') ||
    /\betà\b/.test(lower) ||
    /\beta\b/.test(lower)
  )
}

type InferenceContext = {
  domainHint: Domain
  activeSpecialist?: ActiveSpecialist
}

function inferAttributeToolCallsFromMessage(message: string, ctx: InferenceContext): ToolCall[] {
  const calls: ToolCall[] = []
  const lower = message.toLowerCase()

  const effectiveDomain =
    ctx.activeSpecialist?.domains?.includes(ctx.domainHint) ||
    ctx.activeSpecialist?.domain === ctx.domainHint
      ? ctx.domainHint
      : (ctx.activeSpecialist?.domain ?? ctx.domainHint)

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

  // Nutrition / allergy extraction (robust on "allergico alle ...", "allergia a ...")
  const allergyPatterns = [
    /allergic[oa]\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù'’\s]+)/i,
    /allergia\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù'’\s]+)/i,
  ]
  for (const re of allergyPatterns) {
    const m = lower.match(re)
    const rawAllergen = m?.[1]
    if (!rawAllergen) continue
    const allergen = rawAllergen
      .trim()
      .replace(/[.,;!?]+$/g, '')
      .replace(/^(al|allo|alla|ai|agli|alle)\s+/i, '')
    if (allergen.length >= 2) {
      calls.push({
        id: crypto.randomUUID(),
        name: 'user.setAttribute',
        args: {
          domain: 'nutrition',
          key: 'allergy',
          value: allergen,
        },
      })
      break
    }
  }

  // Training frequency extraction: "mi alleno 4 volte a settimana"
  const freqMatch = lower.match(/alleno\s+(\d{1,2})\s+volt[ea]\s+a\s+settimana/i)
  if (freqMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'training',
        key: 'training_frequency_per_week',
        value: Number(freqMatch[1]),
        unit: 'sessions/week',
      },
    })
  }

  // Health conditions extraction (minimal deterministic)
  if (lower.includes('ipertensione')) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'health',
        key: 'hypertension',
        value: true,
      },
    })
  }
  const yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/)
  if (lower.includes('ipertensione') && yearMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'health',
        key: 'hypertension_diagnosed_year',
        value: Number(yearMatch[1]),
      },
    })
  }

  // Mindfulness extraction
  const stressMatch = lower.match(/stress\s+(\d{1,2})\s*(?:su|\/)\s*10/i)
  if (stressMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'mindfulness',
        key: 'stress_level',
        value: Number(stressMatch[1]),
        unit: '/10',
      },
    })
  }
  const sleepMatch = lower.match(/dormo\s+(\d{1,2})\s+ore/i)
  if (sleepMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'mindfulness',
        key: 'sleep_hours',
        value: Number(sleepMatch[1]),
        unit: 'hours',
      },
    })
  }

  // Ideas / inspiration extraction
  const isQuestionLike =
    lower.includes('?') || lower.startsWith('qual ') || lower.startsWith('quale ')
  if (
    !isQuestionLike &&
    (effectiveDomain === 'inspiration' ||
      lower.includes('obiettivo') ||
      lower.includes('podcast') ||
      lower.includes('progetto'))
  ) {
    const goalText =
      message.match(/obiettivo\s*(?:è|e)?\s*(.+)$/i)?.[1]?.trim() ??
      message.match(/(?:lanciare|avviare)\s+(.+)$/i)?.[0]?.trim()
    if (goalText && goalText.length >= 4) {
      calls.push({
        id: crypto.randomUUID(),
        name: 'user.setAttribute',
        args: {
          domain: 'general',
          key: 'goal',
          value: goalText.slice(0, 240),
        },
      })
    }
  }

  // Deduplicate inferred calls by (name,args)
  const seen = new Set<string>()
  return calls.filter((c) => {
    const k = `${c.name}:${JSON.stringify(c.args)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const GENERIC_QUESTION_PATTERNS = [
  /c['’]e\s+qualcos['’]altro/i,
  /vuoi\s+aggiungere/i,
  /desideri\s+aggiungere/i,
  /come\s+ti\s+senti\s+generalmente/i,
  /cosa\s+vuoi\s+fare/i,
  /cosa\s+intendi/i,
  /posso\s+aiutarti/i,
]

function isGenericQuestion(q: string): boolean {
  const trimmed = q.trim()
  if (!trimmed) return true
  return GENERIC_QUESTION_PATTERNS.some((re) => re.test(trimmed))
}

function readPersonalSnapshot(contextPack: ContextPack): {
  birthDate?: string
  gender?: string
  height?: number
  weight?: number
} {
  const profile = (contextPack.user.profile ?? {}) as Record<string, unknown>
  const attrs = contextPack.user.attributes ?? {}
  const personal = (attrs.personal ?? {}) as Record<string, { value?: unknown }>

  const out: { birthDate?: string; gender?: string; height?: number; weight?: number } = {}

  const birthFromProfile = profile.birthDate
  if (typeof birthFromProfile === 'string' && birthFromProfile) out.birthDate = birthFromProfile
  const birthFromAttr = personal.birthDate?.value
  if (typeof birthFromAttr === 'string' && birthFromAttr) out.birthDate = birthFromAttr

  const genderFromProfile = profile.gender
  if (typeof genderFromProfile === 'string' && genderFromProfile) out.gender = genderFromProfile
  const genderFromAttr = personal.gender?.value
  if (typeof genderFromAttr === 'string' && genderFromAttr) out.gender = genderFromAttr

  const hProfile = profile.height
  if (typeof hProfile === 'number') out.height = hProfile
  const hAttr = personal.height?.value
  if (typeof hAttr === 'number') out.height = hAttr

  const wProfile = profile.weight
  if (typeof wProfile === 'number') out.weight = wProfile
  const wAttr = personal.weight?.value
  if (typeof wAttr === 'number') out.weight = wAttr

  return out
}

function buildSingleMissingQuestion(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
): string | null {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()
  const personal = readPersonalSnapshot(contextPack)

  if (isAgeQuestion(userMessage) && !personal.birthDate) {
    return 'Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).'
  }

  const hasAttr = (d: keyof typeof attrs, key: string): boolean => {
    const bucket = attrs[d] as Record<string, { value?: unknown }> | undefined
    return Boolean(bucket?.[key]?.value != null)
  }

  if (domain === 'nutrition' || lower.includes('dieta') || lower.includes('aliment')) {
    if (!hasAttr('nutrition', 'allergy') && !hasAttr('health', 'allergy')) {
      return 'Hai allergie o intolleranze alimentari da registrare?'
    }
    if (!hasAttr('nutrition', 'goal') && !hasAttr('general', 'goal')) {
      return 'Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?'
    }
    return null
  }

  if (domain === 'training') {
    if (!hasAttr('training', 'training_frequency_per_week')) {
      return 'Quanti allenamenti a settimana riesci a fare realisticamente?'
    }
    return null
  }

  if (domain === 'health') {
    if (!hasAttr('health', 'symptom_duration')) {
      return 'Da quanto tempo è presente il sintomo principale?'
    }
    return null
  }

  if (domain === 'mindfulness') {
    if (!hasAttr('mindfulness', 'stress_level')) {
      return 'Su una scala 0-10, quanto è il tuo livello di stress medio?'
    }
    return null
  }

  return null
}

function buildQuestionPlan(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
): string[] {
  const attrs = contextPack.user.attributes ?? {}
  const lower = userMessage.toLowerCase()
  const personal = readPersonalSnapshot(contextPack)
  const plan: string[] = []

  const hasAttr = (d: keyof typeof attrs, key: string): boolean => {
    const bucket = attrs[d] as Record<string, { value?: unknown }> | undefined
    return Boolean(bucket?.[key]?.value != null)
  }

  if (isAgeQuestion(userMessage) && !personal.birthDate) {
    plan.push('Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).')
  }

  if (domain === 'nutrition' || lower.includes('dieta') || lower.includes('aliment')) {
    if (!hasAttr('nutrition', 'allergy') && !hasAttr('health', 'allergy')) {
      plan.push('Hai allergie o intolleranze alimentari da registrare?')
    }
    if (!hasAttr('nutrition', 'goal') && !hasAttr('general', 'goal')) {
      plan.push('Qual è il tuo obiettivo nutrizionale principale nelle prossime settimane?')
    }
    return plan
  }

  if (domain === 'training') {
    if (!hasAttr('training', 'training_frequency_per_week')) {
      plan.push('Quanti allenamenti a settimana riesci a fare realisticamente?')
    }
    if (!hasAttr('training', 'injury')) {
      plan.push('Hai infortuni o limitazioni fisiche attive da considerare nel piano?')
    }
    return plan
  }

  if (domain === 'health') {
    if (!hasAttr('health', 'symptom_duration')) {
      plan.push('Da quanto tempo è presente il sintomo principale?')
    }
    if (!hasAttr('health', 'diagnosis')) {
      plan.push('Hai già una diagnosi medica confermata o esami recenti disponibili?')
    }
    return plan
  }

  if (domain === 'mindfulness') {
    if (!hasAttr('mindfulness', 'stress_level')) {
      plan.push('Su una scala 0-10, quanto è il tuo livello di stress medio?')
    }
    if (!hasAttr('mindfulness', 'sleep_hours')) {
      plan.push('Quante ore dormi mediamente per notte?')
    }
    return plan
  }

  return plan
}

function getPendingQuestionsFromWorkspace(
  contextPack: ContextPack,
  domain: Domain,
  activeSpecialist?: ActiveSpecialist,
): string[] {
  const workspaces = contextPack.history.agentWorkspaces ?? []
  const selected = workspaces
    .filter((w) => {
      if (activeSpecialist && w.agentId === activeSpecialist.id) return true
      if (w.pendingDomain && w.pendingDomain === domain) return true
      return false
    })
    .flatMap((w) => w.pendingQuestions ?? [])
    .map((q) => q.trim())
    .filter((q) => q.length > 0)

  const seen = new Set<string>()
  return selected.filter((q) => {
    const k = q.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function buildInterviewQueue(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
  activeSpecialist?: ActiveSpecialist,
): { askNow: string[]; pendingNext: string[] } {
  const fromWorkspace = getPendingQuestionsFromWorkspace(contextPack, domain, activeSpecialist)
  const fromPlan = buildQuestionPlan(domain, contextPack, userMessage)
  const merged = [...fromWorkspace, ...fromPlan]
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && !isGenericQuestion(q))
  const seen = new Set<string>()
  const deduped = merged.filter((q) => {
    const k = q.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  if (deduped.length === 0) return { askNow: [], pendingNext: [] }
  return { askNow: [deduped[0]], pendingNext: deduped.slice(1) }
}

function buildCriticalQuestions(
  domain: Domain,
  contextPack: ContextPack,
  userMessage: string,
  _activeSpecialist?: ActiveSpecialist,
): string[] {
  const q = buildSingleMissingQuestion(domain, contextPack, userMessage)
  if (!q || isGenericQuestion(q)) return []
  return [q]
}

function mergeInterviewQuestions(existing: string[], critical: string[]): string[] {
  const specificExisting = existing
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && !isGenericQuestion(q))

  const merged = [...specificExisting]
  for (const q of critical) {
    if (!merged.some((e) => e.toLowerCase() === q.toLowerCase())) merged.push(q)
  }
  return merged
}

function hasEquivalentQuestionInText(text: string, question: string): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4)
  const textTokens = new Set(clean(text))
  const qTokens = clean(question)
  if (qTokens.length === 0) return false
  const overlap = qTokens.filter((t) => textTokens.has(t)).length
  return overlap >= Math.max(2, Math.ceil(qTokens.length * 0.5))
}

function ensureCriticalQuestionsInText(text: string, questions: string[]): string {
  if (questions.length === 0) return text
  const missing = questions.filter((q) => !hasEquivalentQuestionInText(text, q))
  if (missing.length === 0) return text
  return `${text.trim()}\n\nMi manca solo questo dato per risponderti meglio: ${missing[0]}`
}

const SPECIALIST_EXIT_PATTERNS = [
  /esci\s+dalla\s+modalit[aà]\s+specialista/i,
  /torna\s+al\s+team/i,
  /chiudi\s+specialista/i,
  /basta\s+specialista/i,
]

function shouldExitSpecialistMode(message: string): boolean {
  return SPECIALIST_EXIT_PATTERNS.some((re) => re.test(message))
}

function pickSpecialistEffectiveDomain(
  activeSpecialist: ActiveSpecialist | undefined,
  detectedDomain: Domain,
): Domain {
  if (!activeSpecialist) return detectedDomain
  const domains = activeSpecialist.domains ?? [activeSpecialist.domain]
  if (domains.includes(detectedDomain)) return detectedDomain
  const preferred = domains.find((d) => d !== 'general' && d !== 'coordination')
  return preferred ?? activeSpecialist.domain
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
    const fallbackToolCalls = inferAttributeToolCallsFromMessage(input.message, {
      domainHint: input.domainHint ?? 'general',
    })
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
    const fallbackToolCalls = inferAttributeToolCallsFromMessage(input.message, {
      domainHint: input.domainHint ?? 'general',
    })
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
    criticalQuestions: string[]
    contextPack: ContextPack
    activeSpecialist?: ActiveSpecialist
  },
): Promise<string> {
  const {
    userMessage,
    proposals,
    gatingQuestions,
    criticalQuestions,
    contextPack,
    activeSpecialist,
  } = params

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
      `- Se manca un dato fondamentale per il tuo ambito, fai UNA sola domanda mirata`,
      `- Evita domande generiche tipo "c'è altro?" o "come ti senti in generale?"`,
      `- Chiudi con domande operative, non con inviti vaghi`,
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
      `- Se manca un dato critico, fai al massimo UNA domanda di integrazione`,
      `- Evita domande generiche o inviti vaghi`,
      `- Non chiedere informazioni già presenti nel profilo utente`,
      `- Usa il punto fermo, non bullet, per risposte conversazionali brevi`,
      `- Per piani strutturati, usa elenchi numerati senza intestazioni`,
      `- Termina con domande operative mirate solo se mancano dati critici`,
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
      ? `\nINFORMAZIONI MANCANTI GIÀ EMERSE DAL TEAM: ${gatingQuestions.join('; ')}`
      : '',
    criticalQuestions.length ? `\nUNICO DATO CRITICO MANCANTE: ${criticalQuestions[0]}` : '',
    ``,
    `Scrivi una risposta conversazionale in italiano, rivolta direttamente all'utente.`,
    `Se manca un dato critico, fai solo quella domanda e non aggiungerne altre.`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const res = await llm.complete({ system: systemPrompt, user: userPrompt, format: 'text' })
    const text = res.text.trim()
    // Fallback if model accidentally returned JSON
    if (text.startsWith('{') || text.startsWith('[')) {
      const fallback = proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
      return ensureCriticalQuestionsInText(fallback, criticalQuestions)
    }
    return ensureCriticalQuestionsInText(text, criticalQuestions)
  } catch {
    const fallback = proposals.find((p) => p.summary)?.summary ?? 'Come posso aiutarti?'
    return ensureCriticalQuestionsInText(fallback, criticalQuestions)
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const personal = readPersonalSnapshot(input.contextPack)
  if (isAgeQuestion(input.message)) {
    const age = personal.birthDate ? ageFromIsoDate(personal.birthDate) : null
    const response =
      age != null
        ? `Hai ${age} anni.`
        : 'Non ho la tua data di nascita registrata. Per calcolare la tua età indicami la data di nascita in formato gg/mm/aaaa.'
    return {
      domain: 'general',
      finalMessageMarkdown: response,
      toolCallsToExecute: inferAttributeToolCallsFromMessage(input.message, {
        domainHint: 'general',
      }),
      ui: {
        domainIcon: 'general',
        moodScore: input.contextPack.ui.moodScore,
        sectionScores: input.contextPack.ui.sectionScores,
      },
      gatingQuestions:
        age == null
          ? ['Per calcolare la tua età mi serve la tua data di nascita (gg/mm/aaaa).']
          : undefined,
      safety: { escalation: 'none' },
      artifactsToSave: undefined,
      activeSpecialist: input.activeSpecialistId
        ? {
            id: input.activeSpecialistId,
            displayName: input.activeSpecialistId,
            domain: 'general',
          }
        : undefined,
      debug: { selectedAgents: [], conflicts: [] },
    }
  }

  const detectedDomain = input.domainHint ?? detectDomainFromText(input.message)
  const allDomains = detectDomainsMulti(input.message).map((d) => d.domain)

  // Determine active specialist: locked from previous turn OR newly requested this turn
  let activeSpecialist: ActiveSpecialist | undefined
  let lockedAgentId = input.activeSpecialistId ?? null

  if (lockedAgentId && shouldExitSpecialistMode(input.message)) {
    lockedAgentId = null
  }

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
        domain: (agent.domainTags[0] ?? detectedDomain) as Domain,
        domains: agent.domainTags,
      }
    }
  }

  const domainHint = pickSpecialistEffectiveDomain(activeSpecialist, detectedDomain)

  const selectedAgents = activeSpecialist
    ? (() => {
        const base = selectAgentsForRequest(
          deps.team,
          domainHint,
          6,
          allDomains,
          input.message,
        ).filter((a) => a.id !== 'orchestratore')
        const ordered = [
          deps.team.find((a) => a.id === activeSpecialist?.id),
          ...base.filter((a) => a.id !== activeSpecialist?.id),
        ].filter((a): a is AgentProfile => Boolean(a))
        // Collaboration budget to avoid infinite inter-agent loops in specialist mode.
        return ordered.slice(0, 3)
      })()
    : selectAgentsForRequest(deps.team, domainHint, 4, allDomains, input.message)

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

  const queue = buildInterviewQueue(domainHint, input.contextPack, input.message, activeSpecialist)
  const interviewCriticalQuestions = buildCriticalQuestions(
    domainHint,
    input.contextPack,
    input.message,
    activeSpecialist,
  )
  const mergedInterviewQuestions = mergeInterviewQuestions(
    consensus.gatingQuestions ?? [],
    queue.askNow.length > 0 ? queue.askNow : interviewCriticalQuestions,
  )
  const finalInterviewQuestions = mergedInterviewQuestions.slice(0, 1)

  const round2WithQueue: AgentProposal[] = round2Proposals.map((p, idx) => {
    const shouldOwnQueue = activeSpecialist?.id === p.agentId || (!activeSpecialist && idx === 0)
    if (!shouldOwnQueue) return p
    return {
      ...p,
      pendingDomain: domainHint,
      pendingQuestions: queue.pendingNext,
    }
  })

  const hasQueueOwner = round2WithQueue.some((p) => Array.isArray(p.pendingQuestions))
  const round2ForPersistence =
    !hasQueueOwner && queue.pendingNext.length > 0
      ? [
          ...round2WithQueue,
          {
            agentId: activeSpecialist?.id ?? 'orchestratore',
            domain: domainHint,
            summary: 'Interview queue state',
            reasoning: 'Persisted pending interview follow-up questions.',
            questions: [],
            recommendations: [],
            toolCalls: [],
            confidence: 1,
            pendingDomain: domainHint,
            pendingQuestions: queue.pendingNext,
          } satisfies AgentProposal,
        ]
      : round2WithQueue

  const naturalResponse = await synthesizeResponse(deps.llm, {
    userMessage: input.message,
    proposals: round2WithQueue,
    gatingQuestions: finalInterviewQuestions,
    criticalQuestions: finalInterviewQuestions,
    contextPack: input.contextPack,
    activeSpecialist,
  })

  // Deterministic safeguard: if specialists/LLM fail to emit tool-calls,
  // still persist clearly extractable personal data from user text.
  const fallbackToolCalls = inferAttributeToolCallsFromMessage(input.message, {
    domainHint,
    activeSpecialist,
  })
  const mergedToolCalls = [...(consensus.toolCallsToExecute ?? []), ...fallbackToolCalls]
  const dedupedToolCalls = mergedToolCalls.filter((c, idx, arr) => {
    const key = `${c.name}:${JSON.stringify(c.args)}`
    return arr.findIndex((x) => `${x.name}:${JSON.stringify(x.args)}` === key) === idx
  })

  return {
    ...consensus,
    gatingQuestions: finalInterviewQuestions,
    toolCallsToExecute: dedupedToolCalls,
    finalMessageMarkdown: naturalResponse,
    activeSpecialist,
    debug: {
      selectedAgents: consensus.debug?.selectedAgents ?? selectedAgents.map((a) => a.id),
      conflicts: consensus.debug?.conflicts ?? [],
      proposals: round2ForPersistence,
      round1Proposals,
      round2Proposals: round2ForPersistence,
    },
  }
}
