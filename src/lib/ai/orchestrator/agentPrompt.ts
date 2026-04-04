import { AgentInput, ContextPack } from '../types'
import { AGENT_INTAKE_KEYS, flatAttributeMap } from './intakeQuestions'
import { buildProgramStatusBlock } from './agentProgramTracker'
import { getDynamicFieldDescriptor } from '@/lib/dynamicDb/semantics'

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

  const lines: string[] = ['DATI UTENTE DISPONIBILI (raccolti nelle sessioni precedenti):']

  const collectedRequired = intakeKeys.required.filter((key) => attrMap.get(key))
  const collectedOptional = intakeKeys.optional.filter((key) => attrMap.get(key))

  if (collectedRequired.length === 0 && collectedOptional.length === 0) {
    lines.push('(Nessun dato specifico ancora raccolto — usa il contesto della conversazione)')
    return lines
  }

  for (const key of collectedRequired) {
    lines.push(`✓ ${key}: ${attrMap.get(key)}`)
  }

  if (collectedOptional.length > 0) {
    lines.push('')
    lines.push('Dati opzionali disponibili:')
    for (const key of collectedOptional) {
      lines.push(`  ${key}: ${attrMap.get(key)}`)
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
// formatTrend — derive a trend indicator string from attribute history
// ---------------------------------------------------------------------------

function formatTrend(history: Array<{ value: unknown; recordedAt: string }> | undefined): string {
  if (!history || history.length < 2) return ''
  const latest = history[0]
  const older = history[history.length - 1]
  const latestNum = parseFloat(String(latest.value))
  const olderNum = parseFloat(String(older.value))
  if (isNaN(latestNum) || isNaN(olderNum) || latestNum === olderNum) return ''
  const arrow = latestNum < olderNum ? '▼' : '▲'
  const daysDiff = Math.round(
    (new Date(latest.recordedAt).getTime() - new Date(older.recordedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  )
  return ` (${arrow} da ${olderNum} → ${latestNum}, ${daysDiff}gg)`
}

// ---------------------------------------------------------------------------
// Original formatUserAttributes (used as fallback in buildIntakeSection)
// ---------------------------------------------------------------------------

export function formatUserAttributes(input: AgentInput): string[] {
  const attrs = input.contextPack.user.attributes
  if (!attrs) return []

  const attrHistory = input.contextPack.user.attributeHistory

  const lines: string[] = []
  for (const [domain, kv] of Object.entries(attrs)) {
    if (!kv || typeof kv !== 'object') continue
    const entries = Object.entries(
      kv as Record<string, { value: unknown; unit?: string; recordedAt?: string; notes?: string }>,
    )
      .slice(0, 8)
      .map(([k, v]) => {
        const valStr = typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)
        const unitStr = v.unit ? ` ${v.unit}` : ''
        const historyForKey = attrHistory?.[domain]?.[k]
        const trendStr = formatTrend(historyForKey)
        const descriptor = getDynamicFieldDescriptor(k)
        const temporalHint =
          descriptor.semantics === 'observed_temporal_snapshot' && v.recordedAt
            ? ` [osservazione del ${v.recordedAt.slice(0, 10)}; non dato corrente certo senza base derivativa]`
            : ''
        // Show notes: prefer current-entry notes, fall back to most recent history note
        const recentHistoryNote = historyForKey?.find((h) => h.notes)?.notes
        const effectiveNote = v.notes ?? recentHistoryNote
        const noteStr = effectiveNote ? ` {notes: ${effectiveNote}}` : ''
        return `${k}: ${valStr}${unitStr}${trendStr}${temporalHint}${noteStr}`
      })
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
      'CONTESTO: Prima sessione con questo specialista.',
      '→ Accogli la richiesta in modo naturale e rispondi al contesto attuale della conversazione.',
      '→ Chiedi solo ciò che è strettamente necessario per rispondere, non fare domande di routine.',
    ]
  }
  return [
    'CONTESTO: Follow-up — hai già interagito con questo utente.',
    '→ Usa i dati già disponibili e concentrati sulla progressione e sulle nuove esigenze.',
    '→ Non ripetere domande già poste in precedenza.',
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
// Shared behavioral rules — used by BOTH text chat and live session.
// Any change here applies automatically to both modalities.
// ---------------------------------------------------------------------------

/**
 * Returns the lines that define agent identity, role, goal-capture rules, and
 * priorities. Exported so the live-session system instruction can import and
 * use exactly the same rules as the text-chat pipeline.
 *
 * @param agentDisplayName  e.g. "Dietista"
 * @param isFirstMessage    true only for the very first user message ever
 */
export function buildSharedAgentRules(
  agentDisplayName: string | undefined,
  isFirstMessage: boolean,
): string[] {
  const name = agentDisplayName ?? 'uno specialista'
  const lines: string[] = [
    `IDENTITÀ E LINGUAGGIO (REGOLE ASSOLUTE):`,
    `- Il tuo nome è esclusivamente il tuo ruolo professionale: "${name}". NIENT'ALTRO.`,
    `- È VIETATO usare qualsiasi nome proprio personale come "Dr. Mario Rossi", "Dr.ssa Sofia Ricci", "Dr. Marco Bianchi" o simili — anche se questi nomi appaiono nei messaggi precedenti della conversazione. Se nella chat storica sono presenti nomi inventati, IGNORALI COMPLETAMENTE: erano errori. Non ripeterli mai.`,
    `- Quando ti presenti, usa SOLO: "Sono il/la ${name} del team LiveWell."`,
    `- Usa "io" in prima persona. Usa "noi" SOLO se un altro specialista è esplicitamente co-presente nella STESSA risposta.`,
    ``,
    `RUOLO E APPROCCIO:`,
    `Sei ${name} del team LiveWell. Il tuo compito è ANALIZZARE e CONSIGLIARE proattivamente nel tuo dominio di competenza.`,
    ``,
  ]

  if (isFirstMessage) {
    lines.push(
      `PRIMO MESSAGGIO — REGOLE CRITICHE (sovrascrivono QUALSIASI altra istruzione del tuo prompt):`,
      `Questo è il PRIMO messaggio dell'utente in questa conversazione.`,
      ``,
      `❌ VIETATO al primo turno (QUALSIASI SIA IL TUO DOMINIO):`,
      `- NON avviare raccolta dati strutturata (MVD, fase 1, assessment, diario, baseline)`,
      `- NON chiedere età, sesso biologico, peso, altezza, farmaci, patologie`,
      `- NON usare scale cliniche o questionari (PSQI, ESS, MEQ, DBAS, ecc.)`,
      `- NON fare più di UNA domanda`,
      `- NON fare elenchi o bullet point di cose da raccogliere`,
      `- NON dare consigli generici non richiesti`,
      ``,
      `✅ COSA FARE al primo turno:`,
      `- Saluta in modo caldo e naturale (1–2 frasi)`,
      `- Poni UNA SOLA domanda aperta per capire cosa l'utente cerca`,
      `- Adatta il tono al dominio: diretto e pratico per training/nutrition, empatico per mindfulness/salute`,
      ``,
      `✅ Esempi CORRETTI:`,
      `- "Ciao! Su cosa posso aiutarti oggi?"`,
      `- "Benvenuto! Cosa ti ha portato qui?"`,
      `- "Ciao! Di cosa vorresti parlare?"`,
      ``,
      `❌ Esempi SBAGLIATI:`,
      `- "Per iniziare ho bisogno di: età, sesso, peso, altezza…"`,
      `- "Ti faccio alcune domande: 1) quanti anni hai 2) qual è il tuo sesso biologico..."`,
      `- "Per il piano del sonno ho bisogno del diario degli ultimi 7-14 giorni..."`,
      `- "Cominciamo dall'assessment: qual è il tuo obiettivo di performance mentale?"`,
      ``,
    )
  }

  lines.push(
    `DOMAIN MAPPING — REGOLA ASSOLUTA PER setAttribute (errori di dominio = dato inutilizzabile):`,
    `- Pasti, macro (carboidrati/proteine/grassi/calorie), alimenti, dieta, schema alimentare → domain:"nutrition"`,
    `- Attività fisica, sport, allenamento, sessioni, intensità, frequenza settimanale → domain:"training"`,
    `  key:"sport" = SOLO il nome di uno sport/attività (es. "calcio", "nuoto", "corsa"). MAI una frase, ostacolo o sensazione.`,
    `  Se l'utente descrive un ostacolo o un problema legato all'allenamento (es. "fatica con la fame"), salvalo come domain:"general" key:"main_complaint" — NON come sport.`,
    `- Peso, altezza, BMI, composizione corporea, parametri biometrici → domain:"health"`,
    `- Età, sesso, nome → domain:"personal"`,
    `- Obiettivi dichiarati, motivo consulto, sintomi generali → domain:"general"`,
    `- NON usare mai domain:"training" per dati alimentari o domain:"nutrition" per attività fisica.`,
    `- Se l'utente parla di sport E alimentazione nella stessa frase, salva i dati alimentari sotto nutrition E i dati sportivi sotto training — non mescolare MAI in un singolo setAttribute.`,
    ``,
    `VALUTAZIONE CLINICA OBBLIGATORIA (notes in ogni setAttribute):`,
    `- Ogni chiamata setAttribute DEVE includere il campo notes con una breve valutazione clinica del dato.`,
    `- Esempi: notes:"Apporto proteico elevato rispetto al fabbisogno stimato; monitorare funzione renale."`,
    `          notes:"Schema colazione adeguato in macro ma con IG alto per il miele; valutare sostituzione."`,
    `          notes:"Peso in stallo nonostante piano seguito; sospettare sottostima calorica o adattamento metabolico."`,
    `- Se non hai abbastanza dati per una valutazione, scrivi notes:"Dato registrato — valutazione in attesa di più informazioni."`,
    ``,
    `GOAL & COMPLAINT CAPTURE (obbligatorio):`,
    `- Se l'utente risponde a "Qual è la cosa più importante che vorresti migliorare?",`,
    `  salva: user.setAttribute domain:"general" key:"declared_goal" value:<risposta utente>.`,
    `- Se l'utente descrive un problema principale o sintomo, salva:`,
    `  user.setAttribute domain:"general" key:"main_complaint" value:<descrizione>.`,
    `- Se l'utente dichiara solo la propria età (es. "ho 35 anni", "35 anni"), salva:`,
    `  user.setAttribute domain:"personal" key:"age" value:<numero>.`,
    `- NON inventare MAI mese o giorno di nascita e NON convertire mai l'età in una birth_date approssimata.`,
    `- Salva user.setAttribute domain:"personal" key:"birthDate" value:<YYYY-MM-DD> SOLO se l'utente fornisce una data completa reale.`,
    `- Se per un calcolo o una valutazione serve la data di nascita precisa e l'utente ha dato solo l'età, chiedi esplicitamente giorno e mese (o la data completa).`,
    `- DATI MUTEVOLI NEL TEMPO: distingui sempre tra dato OSSERVATO e dato DERIVABILE.`,
    `  Esempio: key:"age" è solo un'osservazione temporale registrata a una certa data; NON trattarla come età corrente certa nei turni futuri.`,
    `  Esempio: key:"birthDate" è un dato base reale da cui il sistema può derivare nel tempo l'età corrente.`,
    `- Quando leggi USER ATTRIBUTES, presta attenzione a recordedAt/notes: per i dati mutevoli usa latest+history, non assumere che un valore osservato settimane o mesi fa sia ancora identico oggi.`,
    ``,
    `REGOLA CANONICA DATI TEMPORALI:`,
    `- DATI STABILI (birthDate, gender, diagnosi permanenti): valori certi, non cambiano nel tempo.`,
    `- DATI OSSERVATI (age, weight, BP, stress, mood): snapshot registrati in una data specifica.`,
    `  → Non usare mai come "valore attuale certo" — potrebbero essere cambiati da quando sono stati rilevati.`,
    `  → Mostra sempre la data di rilevamento: es. "peso 75kg (rilevato il 15 marzo)".`,
    `- DATI DERIVABILI (età corrente da birthDate, BMI da weight+height): calcola sempre dal dato base.`,
    `  → Se hai birthDate, calcola l'età corrente oggi (${new Date().toISOString().slice(0, 10)}) — non usare l'attributo "age" come età corrente certa.`,
    `  → Se hai weight e height, ricalcola il BMI — non fidarti di un attributo BMI registrato mesi fa.`,
    `- STORICO DISPONIBILE: in USER ATTRIBUTES la progressione storica include le note degli agenti per ogni rilevazione.`,
    `  → Usa la progressione temporale per valutare tendenze cliniche, non solo il valore puntuale più recente.`,
    ``,
    `PRIORITÀ (in ordine):`,
    `1. DAI CONSIGLI CONCRETI basati su evidenze scientifiche con i dati già disponibili`,
    `2. Se mancano dati FONDAMENTALI per sicurezza o efficacia, elencali tutti insieme in "questions" (max 3)`,
    `3. NON fare una domanda alla volta — se hai bisogno di info, raccoglile TUTTE in un'unica lista`,
    `4. NON aspettare che l'utente ti dica cosa fare — prendi iniziativa e proponi un piano`,
    `5. NON includere principi generali di settore (es. "idratati", "mangia cibi integrali", "fai pause") a meno che siano parte di un piano strutturato con numeri specifici per l'utente`,
    `6. Prima di inserire una domanda in "questions", verifica che non sia già stata risposta nella conversazione recente`,
    ``,
  )

  return lines
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

  // Build reply-to context if the user is explicitly replying to a specific message.
  // recentMessages now carry `id` so we can do an exact match instead of a heuristic.
  const replyToContext =
    input.replyToMessageId != null
      ? (() => {
          const recentMsgs = input.contextPack.history.recentMessages
          // Exact match by ID (preferred — relies on id being populated in ContextPack)
          const exactTarget = recentMsgs.find(
            (m) => m.id === input.replyToMessageId && m.role === 'assistant',
          )
          const target =
            exactTarget ??
            // Fallback: most-recent assistant message (only when IDs are unavailable)
            [...recentMsgs].reverse().find((m) => m.role === 'assistant')
          return target
            ? `↩ REPLY-TO (l'utente sta rispondendo a questo messaggio assistente specifico): "${target.content.slice(0, 200)}"`
            : null
        })()
      : null

  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ...(replyToContext ? [``, replyToContext] : []),
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
    // G2: Signal incomplete history so agents avoid false completeness claims
    if (input.contextPack.user.hasMoreAttributes) {
      parts.push(
        `⚠ CONTESTO ATTRIBUTI TRONCATO: la cronologia storica degli attributi supera il limite di caricamento (200 entries). ` +
          `I dati più recenti sono presenti, ma dati storici più vecchi potrebbero mancare. ` +
          `Evita affermazioni di completezza su dati storici (es. "non hai mai segnalato X") — potrebbero essere imprecise.`,
      )
    }
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
  // Files that exist but have no extractedText (PDF parse failed, unsupported format)
  const filesMetadataOnly = contextFiles.filter(
    (f) => !f.extractedText || f.extractedText.startsWith('data:'),
  )
  if (filesWithContent.length > 0 || filesMetadataOnly.length > 0) {
    parts.push(``, `ALLEGATI INVIATI DALL'UTENTE:`)
    for (const f of filesWithContent) {
      const sizeKb = Math.round((f.size ?? 0) / 1024)
      parts.push(
        `📎 ${f.filename} (${f.mimeType}, ${sizeKb}KB)${f.recordedAt ? ` — caricato il ${f.recordedAt.slice(0, 10)}` : ''}${f.notes ? ` — note: ${f.notes}` : ''}:`,
        f.extractedText!.slice(0, 4000),
      )
    }
    // Show metadata-only files so agents know they exist (even if content wasn't extracted)
    for (const f of filesMetadataOnly.filter((f) => !f.extractedText)) {
      const sizeKb = Math.round((f.size ?? 0) / 1024)
      parts.push(
        `📎 ${f.filename} (${f.mimeType}, ${sizeKb}KB)${f.recordedAt ? ` — caricato il ${f.recordedAt.slice(0, 10)}` : ''}: [CONTENUTO_NON_DISPONIBILE — il sistema non ha estratto il testo di questo file. NON inventare, ipotizzare o indovinare il contenuto. NON usare esempi come se fossero fatti reali. Quando il documento è rilevante per la tua risposta, dichiara ESPLICITAMENTE "Non ho potuto leggere il documento" e chiedi all'utente di descrivere i dati specifici che ti servono.]`,
      )
    }
    if (filesWithContent.length > 0) {
      parts.push(
        `IMPORTANTE: I file sopra sono stati già inviati dall'utente. Non chiedere di inviare nuovamente documenti già presenti qui.`,
        `ESTRAI E SALVA: Per ogni dato clinico/numerico/rilevante presente nel documento (es. valori ematici, misure antropometriche, farmaci, diagnosi, date) che rientra nel tuo dominio, genera una chiamata setAttribute per salvarlo nella cartella dell'utente. Usa i dati reali del documento — non inventare valori.`,
      )
    }
  }

  // Historical documents from previous conversations (Dynamic DB — all-user scope)
  const allFiles = input.contextPack.files ?? []
  const historicalFiles = allFiles.filter(
    (f) => f.conversationId && f.conversationId !== input.conversationId,
  )
  if (historicalFiles.length > 0) {
    parts.push(``, `DOCUMENTI STORICI (caricati in sessioni precedenti — Dynamic DB):`)
    for (const f of historicalFiles.slice(0, 5)) {
      const sizeKb = Math.round((f.size ?? 0) / 1024)
      const dateStr = f.recordedAt ? f.recordedAt.slice(0, 10) : '?'
      parts.push(
        `📁 ${f.filename} (${f.mimeType}, ${sizeKb}KB) — caricato il ${dateStr}` +
          (f.notes ? ` — note agente: ${f.notes}` : ''),
      )
    }
    parts.push(
      `Questi documenti sono già stati analizzati in sessioni precedenti e i dati rilevanti dovrebbero essere già nei tuoi USER ATTRIBUTES. Puoi fare riferimento a questi documenti per contestualizzare la storia clinica dell'utente.`,
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

  // ── Shared rules (identity, role, priorities) — identical to live session ──
  parts.push(``, ...buildSharedAgentRules(agentDisplayName, isFirstMessage))

  parts.push(
    `PROFILE EXTRACTION (MANDATORY):`,
    `Analizza il messaggio attuale E tutti i messaggi recenti in CONTEXT.recentMessages.`,
    `Se in QUALSIASI messaggio l'utente ha menzionato dati personali (peso, altezza, età/data nascita,`,
    `patologie, sintomi, obiettivi, restrizioni dietetiche, frequenza allenamento, farmaci, allergie,`,
    `ore di sonno, livello di stress, macro alimentari, parametri biometrici, ecc.)`,
    `che non risultano ancora tra gli attributi salvati, INCLUDI SEMPRE un setAttribute per ciascun valore.`,
    `Usa user.setAttribute per tutti i dati strutturati. Usa user.updateProfile solo per compatibilità legacy.`,
    ``,
    `PROGRAM TRACKING (se avvii o aggiorni un percorso):`,
    `Quando definisci un piano strutturato con l'utente, usa user.setAttribute con domain:"program" per registrare:`,
    `- key: "{tuoAgentId}_start" → data odierna ISO (es. "${new Date().toISOString().slice(0, 10)}")`,
    `- key: "{tuoAgentId}_duration_days" → durata pianificata in giorni`,
    `- key: "{tuoAgentId}_checkpoint_days" → array JSON con i giorni di verifica (es. [7,14,21,30])`,
    `- key: "{tuoAgentId}_status" → "active"`,
    `Aggiorna "{tuoAgentId}_status":"completed" o "extended" quando il programma cambia fase.`,
    ``,
    `INSTRUCTIONS:`,
    `- Rispondi SOLO nel tuo ambito di competenza.`,
    `- Fornisci analisi e raccomandazioni basate su evidenze. Usa best practice generali se mancano dati minori.`,
    `- Se i dati utente sono scarsi, inizia con consigli generali + elenca i dati essenziali mancanti.`,
    `- Proponi tool call solo se chiaramente utili; non dichiararne l'esecuzione.`,
    `- L'output deve essere JSON valido che rispetta lo schema seguente.`,
    `- LINGUA: scrivi il campo "reasoning" IN ITALIANO. Non usare mai l'inglese nel reasoning.`,
    ``,
    `CONSULENZA PIRAMIDALE (suggerisci altri specialisti se servono):`,
    `- Se dopo la tua analisi ritieni che per una valutazione completa serva il parere di un altro specialista,`,
    `  indicalo nel campo "suggestedConsultants" con il suo ID (es. ["allergologo", "neurologo"]).`,
    `- Suggerisci consulenti SOLO quando necessario per una diagnosi differenziale o una valutazione interdisciplinare.`,
    `- NON suggerire consulenti per casi banali o già chiari nel tuo dominio.`,
    `- Max 2 consulenti suggeriti per proposta.`,
    `- Esempi:`,
    `  • Oculista che vede "bruciore occhi + lacrimazione" → suggerisce ["allergologo"] per escludere allergia`,
    `  • MMG che vede "mal di testa + formicolio braccio" → suggerisce ["neurologo"] per diagnosi differenziale`,
    `  • Dietista che vede "perdita peso inspiegabile" → suggerisce ["endocrinologo"] per check ormonale`,
    ``,
    `OUTPUT JSON SCHEMA (rispetta esattamente questa struttura):`,
    `{`,
    `  "domain": "nutrizione|allenamento|salute|mindfulness|idee|general",`,
    `  "summary": "analisi e raccomandazioni concrete in italiano, con consigli scientifici diretti",`,
    `  "reasoning": "analisi interna IN ITALIANO — non visibile all'utente",`,
    `  "questions": ["domanda essenziale 1 se mancano dati critici", "domanda 2 se necessario"],`,
    `  "recommendations": [],`,
    `  "toolCalls": [{"id":"uuid","name":"user.setAttribute","args":{"domain":"health","key":"weight","value":80,"unit":"kg"}}],`,
    `  "suggestedConsultants": ["allergologo"],`,
    `  "confidence": 0.8`,
    `}`,
  )

  return parts.join('\n')
}
