import { AgentInput, ContextPack } from '../types'
import { AGENT_INTAKE_KEYS, flatAttributeMap } from './intakeQuestions'
import { buildProgramStatusBlock } from './agentProgramTracker'

// ---------------------------------------------------------------------------
// 1A — buildIntakeSection: shows ✓/✗ per required key for this agent
// ---------------------------------------------------------------------------

function buildIntakeSection(agentId: string, input: AgentInput): string[] {
  const intakeKeys = AGENT_INTAKE_KEYS[agentId]
  if (!intakeKeys) {
    // Fallback: dump all attributes (current behavior for unknown agents)
    return formatUserAttributes(input)
  }

  // F1: Include UserProfile data so weight/height/gender from the profile section
  // are visible in the agent's intake checklist (not just chat-collected attributes).
  const attrMap = flatAttributeMap(
    input.contextPack.user.attributes as
      | Record<string, Record<string, { value: unknown; unit?: string }>>
      | undefined,
    input.contextPack.user.profile as Record<string, unknown> | undefined,
  )

  const lines: string[] = ['INTAKE SPECIALISTICO MINIMO (dati necessari per il tuo dominio):']

  for (const key of intakeKeys.required) {
    const val = attrMap.get(key)
    if (val) {
      lines.push(`✓ ${key}: ${val}`)
    } else {
      lines.push(`✗ ${key} — non ancora raccolto`)
    }
  }

  // Extra attributes outside the required set
  const shownKeys = new Set([...intakeKeys.required, ...intakeKeys.optional])
  const extras: string[] = []
  const attrs = input.contextPack.user.attributes ?? {}
  for (const [domain, domainValues] of Object.entries(
    attrs as Record<string, Record<string, { value: unknown; unit?: string }>>,
  )) {
    if (!domainValues || typeof domainValues !== 'object') continue
    const domainEntries = Object.entries(domainValues)
      .filter(([k, v]) => !shownKeys.has(k) && v?.value != null)
      .map(([k, v]) => {
        const display = typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)
        return `${k}: ${display}${v.unit ? ` ${v.unit}` : ''}`
      })
    if (domainEntries.length > 0) {
      extras.push(`[${domain}] ${domainEntries.slice(0, 6).join(' | ')}`)
    }
  }
  if (extras.length > 0) {
    lines.push('', 'ALTRI ATTRIBUTI DISPONIBILI:', ...extras)
  }

  return lines
}

// ---------------------------------------------------------------------------
// Original formatUserAttributes (used as fallback in buildIntakeSection)
// ---------------------------------------------------------------------------

export function formatUserAttributes(input: AgentInput): string[] {
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

// ---------------------------------------------------------------------------
// 1B — detectSessionMode: first_session vs follow_up
// ---------------------------------------------------------------------------

function detectSessionMode(
  agentId: string,
  contextPack: ContextPack,
): 'first_session' | 'follow_up' {
  const hasWorkspace = contextPack.history.agentWorkspaces?.some((w) => w.agentId === agentId)
  return hasWorkspace ? 'follow_up' : 'first_session'
}

function buildSessionModeBlock(mode: 'first_session' | 'follow_up'): string[] {
  if (mode === 'first_session') {
    return [
      'SESSION MODE: PRIMA SESSIONE',
      '→ Raccogli i dati mancanti (vedi INTAKE SPECIALISTICO), poni UNA domanda aperta.',
    ]
  }
  return [
    'SESSION MODE: FOLLOW-UP',
    "→ L'utente ha già lavorato con te. Usa il framework di follow-up:",
    '  apertura → dati oggettivi → aderenza → analisi 4 aree → cambiamenti percepiti → revisione obiettivi',
  ]
}

// ---------------------------------------------------------------------------
// 1C — buildWeeklyTrendSummary: computes trends from contextPack.trackers
// ---------------------------------------------------------------------------

function buildWeeklyTrendSummary(contextPack: ContextPack): string[] {
  const trackers = contextPack.trackers
  if (!trackers) return []

  const lines: string[] = []

  // --- Weight trend from health tracker ---
  const healthTracker = trackers.health as
    | { bodyMetrics?: Array<{ weight?: number; recordedAt?: string }> }
    | undefined
  const bodyMetrics = healthTracker?.bodyMetrics
  if (Array.isArray(bodyMetrics) && bodyMetrics.length >= 2) {
    const sorted = [...bodyMetrics]
      .filter((e) => e.weight != null)
      .sort((a, b) => {
        const ta = a.recordedAt ? new Date(a.recordedAt).getTime() : 0
        const tb = b.recordedAt ? new Date(b.recordedAt).getTime() : 0
        return ta - tb
      })
    if (sorted.length >= 2) {
      const first = sorted[0].weight!
      const last = sorted[sorted.length - 1].weight!
      const delta = last - first
      const arrow = delta < -0.05 ? '▼' : delta > 0.05 ? '▲' : '='
      lines.push(
        `Peso: ${first.toFixed(1)} → ${last.toFixed(1)} kg (${arrow} ${Math.abs(delta).toFixed(1)} kg)`,
      )
    }
  }

  // --- Training sessions from training tracker ---
  const trainingTracker = trackers.training as
    | { sessions?: Array<{ durationMin?: number; recordedAt?: string }> }
    | undefined
  const sessions = trainingTracker?.sessions
  if (Array.isArray(sessions) && sessions.length > 0) {
    const avgDuration = sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0) / sessions.length
    lines.push(
      `Allenamenti: ${sessions.length} session${sessions.length === 1 ? 'e' : 'i'} (media ${Math.round(avgDuration)} min)`,
    )
  }

  // --- Average calories from nutrition tracker ---
  const nutritionTracker = trackers.nutrition as
    | { meals?: Array<{ calories?: number; recordedAt?: string }> }
    | undefined
  const meals = nutritionTracker?.meals
  if (Array.isArray(meals) && meals.length > 0) {
    const byDay: Record<string, number[]> = {}
    for (const meal of meals) {
      if (meal.calories == null) continue
      const day = meal.recordedAt ? meal.recordedAt.slice(0, 10) : 'unknown'
      byDay[day] = byDay[day] ?? []
      byDay[day].push(meal.calories)
    }
    const days = Object.values(byDay)
    if (days.length > 0) {
      const dailyTotals = days.map((cals) => cals.reduce((a, b) => a + b, 0))
      const avg = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length
      lines.push(`Calorie: media ${Math.round(avg)} kcal/giorno`)
    }
  }

  // --- Mindfulness sessions from mindfulness tracker ---
  const mindfulnessTracker = trackers.mindfulness as
    | { sessions?: Array<{ moodScore?: number; recordedAt?: string }> }
    | undefined
  const mindSessions = mindfulnessTracker?.sessions
  if (Array.isArray(mindSessions) && mindSessions.length > 0) {
    const withMood = mindSessions.filter((s) => s.moodScore != null)
    const avgMood =
      withMood.length > 0
        ? withMood.reduce((sum, s) => sum + s.moodScore!, 0) / withMood.length
        : null
    lines.push(
      `Mindfulness: ${mindSessions.length} session${mindSessions.length === 1 ? 'e' : 'i'}` +
        (avgMood != null ? ` (mood medio: ${avgMood.toFixed(1)}/10)` : ''),
    )
  }

  if (lines.length === 0) return []

  return ['TREND SETTIMANALE (ultimi 7 giorni):', ...lines]
}

// ---------------------------------------------------------------------------
// 1D — buildCrossSessionContext: continuity from previous conversations
// ---------------------------------------------------------------------------

function buildCrossSessionContext(contextPack: ContextPack): string[] {
  const msgs = contextPack.history.crossConversationMessages
  if (!msgs || msgs.length === 0) return []

  const assistantMsgs = msgs.filter((m) => m.role === 'assistant').slice(0, 2)
  if (assistantMsgs.length === 0) return []

  const lines: string[] = ['CONTESTO SESSIONI PRECEDENTI:']
  for (const msg of assistantMsgs) {
    const date = msg.createdAt
      ? new Date(msg.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
      : '?'
    const snippet = msg.content.length > 300 ? msg.content.slice(0, 297) + '…' : msg.content
    lines.push(`[${date}] "${snippet}"`)
  }
  return lines
}

// ---------------------------------------------------------------------------
// Helpers (unchanged)
// ---------------------------------------------------------------------------

function formatProfileSummary(input: AgentInput): string | null {
  if (!input.contextPack.user.profile || Object.keys(input.contextPack.user.profile).length === 0) {
    return null
  }

  return Object.entries(input.contextPack.user.profile)
    .slice(0, 10)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ')
}

function extractPreviousTeamQuestions(input: AgentInput): string[] {
  const lastAssistant = input.contextPack.history.recentMessages
    .filter((m) => m.role === 'assistant')
    .slice(-1)[0]

  if (!lastAssistant) return []

  return lastAssistant.content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('?'))
    .slice(0, 6)
}

// ---------------------------------------------------------------------------
// Main export — integrates all improvements
// ---------------------------------------------------------------------------

export function buildAgentUserPrompt(
  input: AgentInput,
  agentId: string,
  peerInsights?: string,
  agentDisplayName?: string,
): string {
  // Extract user name from profile (injected by contextPackBuilder from User.name account field)
  const profileRaw = input.contextPack.user.profile as Record<string, unknown> | undefined
  const accountName =
    profileRaw?.name && typeof profileRaw.name === 'string' ? profileRaw.name : null
  // Also check personal.name attribute as fallback
  const personalAttr = (
    input.contextPack.user.attributes as
      | Record<string, Record<string, { value?: unknown }>>
      | undefined
  )?.personal
  const attrName =
    personalAttr?.name?.value && typeof personalAttr.name.value === 'string'
      ? personalAttr.name.value
      : null
  const userName = accountName ?? attrName

  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ``,
    `CONTEXT (summary):`,
    ...(userName ? [`- userName: ${userName} (usa questo nome quando ti rivolgi all'utente)`] : []),
    `- role: ${input.contextPack.user.role}`,
    `- moodScore: ${input.contextPack.ui.moodScore}`,
    `- recentMessages: ${input.contextPack.history.recentMessages
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join(' | ')}`,
  ]

  const profileSummary = formatProfileSummary(input)
  if (profileSummary) {
    parts.push(`- userProfile: ${profileSummary}`)
  }

  // 1A — User attributes: full domain-grouped dump (source of truth for the LLM)
  const userAttrLines = formatUserAttributes(input)
  if (userAttrLines.length > 0) {
    parts.push(``, `USER ATTRIBUTES (fonte principale dinamica):`, ...userAttrLines)
  }

  // 1A2 — Intake section: structured ✓/✗ checklist for known agents
  const intakeLines = buildIntakeSection(agentId, input)
  // For known agents buildIntakeSection returns the INTAKE SPECIALISTICO block;
  // for unknown agents it returns formatUserAttributes (already included above — skip).
  if (intakeLines.length > 0 && AGENT_INTAKE_KEYS[agentId]) {
    parts.push(``, ...intakeLines)
  }

  // 1A3 — Uploaded files / documents with extracted content
  const contextFiles = input.contextPack.files ?? []
  const filesWithContent = contextFiles.filter(
    (f) => f.extractedText && !f.extractedText.startsWith('data:'),
  )
  if (filesWithContent.length > 0) {
    parts.push(``, `ALLEGATI INVIATI DALL'UTENTE:`)
    for (const f of filesWithContent) {
      const sizeKb = Math.round((f.size ?? 0) / 1024)
      parts.push(`📎 ${f.filename} (${f.mimeType}, ${sizeKb}KB):`, f.extractedText!.slice(0, 4000))
    }
    parts.push(
      `IMPORTANTE: I file sopra sono stati già inviati dall'utente. Non chiedere di inviare nuovamente documenti già presenti qui.`,
    )
  }

  // 1B — Session mode
  const sessionMode = detectSessionMode(agentId, input.contextPack)
  parts.push(``, ...buildSessionModeBlock(sessionMode))

  // Layer 2 — Program status block
  const programLines = buildProgramStatusBlock(agentId, input.contextPack)
  if (programLines.length > 0) {
    parts.push(``, ...programLines)
  }

  // 1C — Weekly trend summary
  const trendLines = buildWeeklyTrendSummary(input.contextPack)
  if (trendLines.length > 0) {
    parts.push(``, ...trendLines)
  }

  // 1D — Cross-session context
  const crossLines = buildCrossSessionContext(input.contextPack)
  if (crossLines.length > 0) {
    parts.push(``, ...crossLines)
  }

  const ownWorkspace = input.contextPack.history.agentWorkspaces?.find((w) => w.agentId === agentId)
  if (ownWorkspace?.round2Summary) {
    parts.push(``, `WORKSPACE MEMORIA TURNO PRECEDENTE:`, ownWorkspace.round2Summary)
  }

  const prevQuestions = extractPreviousTeamQuestions(input)
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

  // Medical record completeness — show what data is still missing
  const medRec = input.contextPack.user.medicalRecord
  if (medRec) {
    const completenessLines: string[] = []
    for (const [domain, comp] of Object.entries(medRec.completeness)) {
      const missing = medRec.missingKeys[domain] ?? []
      if (comp.pct < 100) {
        const missingStr = missing.slice(0, 4).join(', ')
        completenessLines.push(`[${domain}] ${comp.pct}% — mancano: ${missingStr}`)
      }
    }
    if (completenessLines.length > 0) {
      parts.push(``, `CARTELLA CLINICA — COMPLETEZZA PROFILO:`, ...completenessLines)
      parts.push(
        `Quando l'utente menziona uno di questi dati, includi SEMPRE un tool call user.setAttribute.`,
        `Chiedi i dati mancanti solo se contestualmente rilevante, tutti insieme come lista numerata.`,
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

  // True only when user has genuinely never spoken to the system before
  // (no messages in current conversation AND no messages in prior conversations)
  const isFirstMessage =
    input.contextPack.history.recentMessages.length === 0 &&
    (input.contextPack.history.crossConversationMessages?.length ?? 0) === 0

  parts.push(
    ``,
    `PROFILE EXTRACTION (MANDATORY):`,
    `If the user mentions ANY personal data (weight, height, age, medical conditions, symptoms,`,
    `goals, diet restrictions, training frequency, medications, allergies, sleep hours, stress level etc.),`,
    `ALWAYS include a "user.setAttribute" tool call in your toolCalls[] with extracted values.`,
    `Use user.updateProfile only for legacy compatibility when needed by profile snapshot.`,
    ``,
    `PROGRAM TRACKING (se avvii o aggiorni un percorso):`,
    `Quando definisci un piano strutturato con l'utente, usa user.setAttribute con domain:"program" per registrare:`,
    `- key: "{tuoAgentId}_start" → data odierna ISO (es. "${new Date().toISOString().slice(0, 10)}")`,
    `- key: "{tuoAgentId}_duration_days" → durata pianificata in giorni`,
    `- key: "{tuoAgentId}_checkpoint_days" → array JSON con i giorni di verifica (es. [7,14,21,30])`,
    `- key: "{tuoAgentId}_status" → "active"`,
    `Aggiorna "{tuoAgentId}_status":"completed" o "extended" quando il programma cambia fase.`,
    ``,
    `RUOLO E APPROCCIO:`,
    `Sei ${agentDisplayName ?? 'uno specialista'} del team LiveWell. Il tuo compito è ANALIZZARE e CONSIGLIARE proattivamente nel tuo dominio di competenza.`,
    ``,
  )

  if (isFirstMessage) {
    parts.push(
      `PRIMO MESSAGGIO — REGOLE SPECIALI:`,
      `Questo è il PRIMO messaggio dell'utente in questa conversazione.`,
      `- NON dare consigli generici non richiesti (idratazione, sonno, esercizio generico, ecc.)`,
      `- NON dare tips preventivi se l'utente non ha chiesto nulla di specifico`,
      `- Saluta calorosamente e poni UNA SOLA domanda aperta per capire cosa cerca`,
      `- Esempio corretto: "Ciao! Sono qui per supportarti. Cosa vorresti migliorare o su cosa posso aiutarti?"`,
      `- Esempio SBAGLIATO: "Ciao! Un consiglio: bevi 2 litri d'acqua al giorno. Ora dimmi: qual è il tuo obiettivo?"`,
      ``,
    )
  }

  parts.push(
    `GOAL & COMPLAINT CAPTURE (obbligatorio):`,
    `- Se l'utente risponde a "Qual è la cosa più importante che vorresti migliorare?",`,
    `  salva: user.setAttribute domain:"general" key:"declared_goal" value:<risposta utente>.`,
    `- Se l'utente descrive un problema principale o sintomo, salva:`,
    `  user.setAttribute domain:"general" key:"main_complaint" value:<descrizione>.`,
    `- Se l'utente dichiara la propria età (es. "ho 35 anni", "35 anni"), salva:`,
    `  user.setAttribute domain:"personal" key:"age" value:<numero>.`,
    ``,
    `PRIORITÀ (in ordine):`,
    `1. DAI CONSIGLI CONCRETI basati su evidenze scientifiche con i dati già disponibili`,
    `2. Se mancano dati FONDAMENTALI per sicurezza o efficacia, elencali tutti insieme in "questions" (max 3)`,
    `3. NON fare una domanda alla volta — se hai bisogno di info, raccoglile TUTTE in un'unica lista`,
    `4. NON aspettare che l'utente ti dica cosa fare — prendi iniziativa e proponi un piano`,
    `5. NON includere principi generali di settore (es. "idratati", "mangia cibi integrali", "fai pause") a meno che siano parte di un piano strutturato con numeri specifici per l'utente`,
    `6. Prima di inserire una domanda in "questions", verifica che non sia già stata risposta nella conversazione recente`,
    ``,
    `INSTRUCTIONS:`,
    `- Respond ONLY within your domain scope.`,
    `- Provide evidence-based analysis and recommendations. Assume reasonable defaults if minor data missing.`,
    `- If user data is sparse, start with general best-practice advice + list essential missing data.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
    `- Output must be valid JSON matching the schema below.`,
    ``,
    `OUTPUT JSON SCHEMA (rispetta esattamente questa struttura):`,
    `{`,
    `  "domain": "nutrizione|allenamento|salute|mindfulness|idee|general",`,
    `  "summary": "analisi e raccomandazioni concrete in italiano, con consigli scientifici diretti",`,
    `  "reasoning": "analisi interna non visibile all'utente",`,
    `  "questions": ["domanda essenziale 1 se mancano dati critici", "domanda 2 se necessario"],`,
    `  "recommendations": [],`,
    `  "toolCalls": [{"id":"uuid","name":"user.setAttribute","args":{"domain":"health","key":"weight","value":80,"unit":"kg"}}],`,
    `  "confidence": 0.8`,
    `}`,
  )

  return parts.join('\n')
}
