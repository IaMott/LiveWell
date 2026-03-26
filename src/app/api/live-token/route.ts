import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { errorResponse } from '@/lib/security/errorSchema'
import { getAuthUserId } from '@/lib/auth'
import { stripAssistantStoredMetadata } from '@/lib/chat/thinkingPersistence'
import { getServerSecret } from '@/lib/security/secrets'
import { getServerEnv } from '@/lib/validators/env'
import { prisma } from '@/lib/prisma'
import { logApiErrorEvent } from '@/lib/monitoring/apiErrorEvents'
import * as fs from 'fs'
import * as path from 'path'
import { buildSharedAgentRules } from '@/lib/ai/orchestrator/agentPrompt'
import { toCanonicalCaseStateSnapshot } from '@/lib/ai/case/compat'
import { fromStoredCaseState } from '@/lib/ai/case/persistence'
import type { CanonicalCaseStateSnapshot } from '@/lib/ai/types'

const requestSchema = z.object({
  conversationId: z.string().min(1).optional(),
})

const toIsoInMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

/**
 * Normalise the ephemeral-token name returned by authTokens.create()
 * to the `auth_tokens/<id>` format expected by the SDK as apiKey.
 */
function normalizeEphemeralToken(name: string): string {
  const t = name.trim()
  if (!t) return t
  if (t.startsWith('auth_tokens/')) return t
  if (t.startsWith('authTokens/')) return `auth_tokens/${t.slice('authTokens/'.length)}`
  const marker = '/authTokens/'
  const idx = t.indexOf(marker)
  if (idx >= 0) return `auth_tokens/${t.slice(idx + marker.length)}`
  return t
}

function getAge(birthDate: Date): number {
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--
  return age
}

type AttrRow = {
  domain: string
  key: string
  value: unknown
  unit: string | null
  recordedAt: Date
  notes: string | null
}

type LiveCaseBootstrap = {
  activeAgentId: string | null
  stateSnapshot: CanonicalCaseStateSnapshot | null
}

function formatAttributesForPrompt(rows: AttrRow[]): string {
  if (rows.length === 0) return ''

  const seen = new Set<string>()
  const kept: AttrRow[] = []
  for (const row of rows) {
    const k = `${row.domain}:${row.key}`
    if (!seen.has(k)) {
      seen.add(k)
      kept.push(row)
    }
  }

  const byDomain = new Map<string, AttrRow[]>()
  for (const row of kept) {
    const bucket = byDomain.get(row.domain) ?? []
    bucket.push(row)
    byDomain.set(row.domain, bucket)
  }

  const lines: string[] = ['ATTRIBUTI REGISTRATI DAGLI AGENTI:']
  for (const [domain, entries] of byDomain.entries()) {
    lines.push(`[${domain}]`)
    for (const e of entries) {
      const value = typeof e.value === 'object' ? JSON.stringify(e.value) : String(e.value)
      const unit = e.unit ? ` ${e.unit}` : ''
      lines.push(
        `  ${e.key}: ${value}${unit} (${e.recordedAt.toISOString().slice(0, 10)})${e.notes ? ` — ${e.notes}` : ''}`,
      )
    }
  }

  return lines.join('\n')
}

function formatPanelSummary(snapshot: CanonicalCaseStateSnapshot | null): string {
  if (!snapshot) return ''

  const lines: string[] = ['PANEL MULTI-DOMINIO ATTIVO PER QUESTA CONVERSAZIONE:']
  lines.push(`leadDomain: ${snapshot.leadDomain ?? 'non-definito'}`)
  lines.push(`speakerPolicy: ${snapshot.speakerPolicy}`)
  if (snapshot.activeDomains.length > 0) {
    lines.push(`activeDomains: ${snapshot.activeDomains.join(', ')}`)
  }
  for (const panel of snapshot.domainPanels) {
    const selected = panel.selectedAgentId ?? 'non-assegnato'
    const candidates = panel.candidateAgentIds.join(', ') || 'nessuno'
    lines.push(
      `- ${panel.domain}: selected=${selected}; status=${panel.status}; priority=${panel.priorityScore}; candidates=${candidates}`,
    )
  }
  if (snapshot.sharedOpenQuestions.length > 0) {
    lines.push(`sharedOpenQuestions: ${snapshot.sharedOpenQuestions.join(' | ')}`)
  }
  return lines.join('\n')
}

const TEAM_DIR = path.join(process.cwd(), 'TEAM')

/**
 * Recursively scan TEAM directory to find an agent directory by its `id` field
 * in profile.json. Returns the directory path or null if not found.
 */
function findAgentDir(agentId: string): string | null {
  if (!fs.existsSync(TEAM_DIR)) return null
  for (const entry of fs.readdirSync(TEAM_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const top = path.join(TEAM_DIR, entry.name)
    // flat layout: TEAM/<agentId>/profile.json
    const flatProfile = path.join(top, 'profile.json')
    if (fs.existsSync(flatProfile)) {
      try {
        const p = JSON.parse(fs.readFileSync(flatProfile, 'utf-8')) as { id?: string }
        if (p.id === agentId) return top
      } catch {
        /* skip */
      }
    }
    // nested layout: TEAM/<domain>/<agentId>/profile.json
    for (const sub of fs.readdirSync(top, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue
      const subDir = path.join(top, sub.name)
      const nestedProfile = path.join(subDir, 'profile.json')
      if (fs.existsSync(nestedProfile)) {
        try {
          const p = JSON.parse(fs.readFileSync(nestedProfile, 'utf-8')) as { id?: string }
          if (p.id === agentId) return subDir
        } catch {
          /* skip */
        }
      }
    }
  }
  return null
}

/**
 * Load the prompt.md for a given agentId. Returns null if not found.
 */
function loadAgentPrompt(agentId: string): { displayName: string; prompt: string } | null {
  const dir = findAgentDir(agentId)
  if (!dir) return null
  const promptPath = path.join(dir, 'prompt.md')
  if (!fs.existsSync(promptPath)) return null
  const profilePath = path.join(dir, 'profile.json')
  let displayName = agentId
  try {
    const p = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as { displayName?: string }
    if (p.displayName) displayName = p.displayName
  } catch {
    /* skip */
  }
  return { displayName, prompt: fs.readFileSync(promptPath, 'utf-8') }
}

async function getLiveCaseBootstrap(
  userId: string,
  conversationId?: string | null,
): Promise<LiveCaseBootstrap> {
  const cs = conversationId
    ? await prisma.caseState.findUnique({
        where: { conversationId },
      })
    : await prisma.caseState.findFirst({
        where: { conversation: { userId } },
        orderBy: { updatedAt: 'desc' },
      })
  if (!cs) return { activeAgentId: null, stateSnapshot: null }
  const caseState = fromStoredCaseState(cs)
  if (!caseState) return { activeAgentId: null, stateSnapshot: null }
  const stateSnapshot = toCanonicalCaseStateSnapshot(caseState)
  const leadPanel =
    stateSnapshot?.domainPanels.find((panel) => panel.domain === stateSnapshot.leadDomain) ??
    stateSnapshot?.domainPanels[0]
  return {
    activeAgentId:
      leadPanel?.selectedAgentId ??
      caseState.activeSpeakerAgentId ??
      caseState.ownerAgentId ??
      null,
    stateSnapshot,
  }
}

/**
 * Build a rich system instruction for the Gemini Live session.
 * Includes user profile, recent chat history across ALL conversations,
 * and tracker summary so the Live agent has full context from the start.
 */
async function buildLiveSystemInstruction(
  userId: string,
  conversationId?: string | null,
): Promise<string> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  // Resolve active specialist in parallel with DB queries
  const [liveCaseBootstrap, queryResults] = await Promise.all([
    getLiveCaseBootstrap(userId, conversationId),
    Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          birthDate: true,
          gender: true,
          height: true,
          weight: true,
          health: true,
          nutrition: true,
          training: true,
          mindfulness: true,
          goals: true,
        },
      }),
      // Last 30 messages across ALL user conversations (cross-conversation memory)
      prisma.message.findMany({
        where: { conversation: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { role: true, content: true, createdAt: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId, date: { gte: since7d } },
        select: { durationMin: true, notes: true, date: true },
        take: 20,
      }),
      prisma.meal.findMany({
        where: { createdByUserId: userId, date: { gte: since7d } },
        select: { mealType: true, date: true },
        take: 20,
      }),
      prisma.mindfulnessEntry.findMany({
        where: { userId, createdAt: { gte: since7d } },
        select: { mood: true, stress: true },
        take: 10,
      }),
      prisma.userAttribute.findMany({
        where: {
          userId,
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        orderBy: { recordedAt: 'desc' },
        take: 100,
        select: { domain: true, key: true, value: true, unit: true, recordedAt: true, notes: true },
      }),
    ]),
  ])

  const { activeAgentId, stateSnapshot } = liveCaseBootstrap
  const [user, profile, recentMessages, workouts, meals, mindfulness, attrRows] = queryResults

  // ── Load active specialist prompt (if any) ─────────────────────────────────
  const agentInfo = activeAgentId ? loadAgentPrompt(activeAgentId) : null

  const lines: string[] = []

  // ── Identity: specialist or generic ───────────────────────────────────────
  if (agentInfo) {
    lines.push(
      `Sei ${agentInfo.displayName} del team LiveWell. ` +
        'Rispondi SOLO in italiano, in modo naturale e conversazionale. ' +
        'Stai conducendo una sessione audio/video in tempo reale.',
    )
    lines.push(`SPECIALISTA ATTIVO PER QUESTA CONVERSAZIONE: ${agentInfo.displayName}`)
    lines.push(`\n=== REGOLE DEL TUO RUOLO (${agentInfo.displayName.toUpperCase()}) ===`)
    lines.push(agentInfo.prompt)
    lines.push('=== FINE REGOLE RUOLO ===\n')
  } else {
    lines.push(
      'Sei un assistente AI per la salute e il benessere personale. ' +
        'Rispondi in italiano in modo naturale, conciso e conversazionale. ' +
        "Sei parte di un team multidisciplinare (nutrizionisti, allenatori, medici, psicologi) e hai pieno accesso al profilo e alla cronologia dell'utente.",
    )
  }

  const panelSummary = formatPanelSummary(stateSnapshot)
  if (panelSummary) {
    lines.push(`\n${panelSummary}`)
  }

  // ── Shared behavioral rules — exactly the same as the text-chat pipeline ──
  // isFirstMessage = true when there are no messages in DB yet for this user
  const isFirstMessage = recentMessages.length === 0
  lines.push('', ...buildSharedAgentRules(agentInfo?.displayName, isFirstMessage))

  // ── Live-only adaptations (output format, environment constraints) ─────────
  // These do NOT duplicate any text-chat rules — they only adapt the response
  // format and environment constraints specific to real-time audio/video.
  lines.push(
    'MODALITÀ LIVE AUDIO/VIDEO (adattamenti al formato, non cambiano le regole sopra):',
    '- Sei in un\'app virtuale. NON suggerire mai "fissare un appuntamento", "incontrarsi di persona" o riferimenti a uno studio fisico. Tutto avviene nell\'app.',
    "- Se hai accesso video e vedi l'utente, NON commentarne l'aspetto fisico, abbigliamento o corpo. Focus clinico/professionale sempre.",
    '- NON inventare scenari ipotetici o appuntamenti immaginari.',
    '- Rispondi SOLO in italiano. Nessuna parola inglese.',
    '- Se parli sia di sport che di alimentazione nella stessa risposta, tratta i domini separatamente.',
    "- Non puoi trasferire audio ad altri agenti: se serve un altro specialista, annuncialo verbalmente e di' che la consulenza avverrà nella chat testuale.",
    '- Risposte brevi e naturali come in una telefonata. NO elenchi puntati lunghi. NO JSON.',
  )

  // ── User identity ──────────────────────────────────────────────────────────
  const userName = user?.name ?? null
  if (userName) lines.push(`\nSTAI PARLANDO CON: ${userName}`)

  // ── Profile summary ────────────────────────────────────────────────────────
  if (profile) {
    const profileParts: string[] = []
    if (profile.birthDate) profileParts.push(`età ${getAge(new Date(profile.birthDate))} anni`)
    if (profile.gender) profileParts.push(`sesso: ${profile.gender}`)
    if (profile.weight) profileParts.push(`peso: ${profile.weight} kg`)
    if (profile.height) profileParts.push(`altezza: ${profile.height} cm`)

    if (profileParts.length > 0) {
      lines.push(`\nPROFILO: ${profileParts.join(', ')}`)
    }

    const goals = profile.goals as Record<string, unknown> | null
    const goalsText = goals?.objectives ?? goals?.text ?? goals?.goals
    if (goalsText) lines.push(`OBIETTIVI: ${String(goalsText).slice(0, 300)}`)

    const health = profile.health as Record<string, unknown> | null
    const conditions = health?.conditions ?? health?.chronicConditions
    if (conditions) lines.push(`CONDIZIONI SALUTE: ${String(conditions).slice(0, 200)}`)

    const nutrition = profile.nutrition as Record<string, unknown> | null
    const diet = nutrition?.dietType ?? nutrition?.preferences
    if (diet) lines.push(`ALIMENTAZIONE: ${String(diet).slice(0, 150)}`)

    const training = profile.training as Record<string, unknown> | null
    const freq = training?.frequency ?? training?.weeklyDays
    if (freq) lines.push(`ALLENAMENTO: ${String(freq)} volte/settimana`)
  }

  if (attrRows.length > 0) {
    const attrs = formatAttributesForPrompt(attrRows)
    if (attrs) lines.push(`\n${attrs}`)
  }

  // ── Tracker summary (last 7 days) ──────────────────────────────────────────
  const trackerParts: string[] = []
  if (workouts.length > 0) trackerParts.push(`${workouts.length} allenamenti`)
  if (meals.length > 0) trackerParts.push(`${meals.length} pasti registrati`)
  if (mindfulness.length > 0) trackerParts.push(`${mindfulness.length} sessioni mindfulness`)
  if (trackerParts.length > 0) {
    lines.push(`\nULTIMI 7 GIORNI: ${trackerParts.join(', ')}`)
  }
  if (mindfulness.length > 0) {
    const avgMood =
      mindfulness.filter((e) => e.mood != null).reduce((s, e) => s + (e.mood ?? 0), 0) /
      (mindfulness.filter((e) => e.mood != null).length || 1)
    if (avgMood > 0) lines.push(`UMORE MEDIO (settimana): ${Math.round(avgMood)}/10`)
  }

  // ── Conversation history (cross-conversation) ──────────────────────────────
  if (recentMessages.length > 0) {
    lines.push('\nCRONOLOGIA CHAT RECENTE (ultime conversazioni):')
    // reverse to chronological order
    const ordered = recentMessages.slice().reverse()
    for (const msg of ordered) {
      const speaker = msg.role === 'user' ? 'Utente' : 'Assistente'
      const snippet = (
        msg.role === 'assistant' ? stripAssistantStoredMetadata(msg.content) : msg.content
      )
        .slice(0, 200)
        .replace(/\n/g, ' ')
      lines.push(`${speaker}: ${snippet}`)
    }
  } else {
    lines.push('\n(Nessuna conversazione precedente registrata)')
  }

  lines.push(
    '\nUSA queste informazioni per rispondere in modo contestualizzato e personalizzato. ' +
      'Fai riferimento alla cronologia e al profilo quando pertinente.',
  )

  return lines.join('\n')
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  const userId = await getAuthUserId(request)
  if (!userId) {
    await logApiErrorEvent({
      endpoint: '/api/live-token',
      errorCode: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Authentication required',
      requestId,
      userId: null,
    })
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')
  }

  let parsedBody: z.infer<typeof requestSchema>
  try {
    const body = (await request.json()) as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      await logApiErrorEvent({
        endpoint: '/api/live-token',
        errorCode: 'BAD_REQUEST',
        statusCode: 400,
        message: 'Invalid request body',
        requestId,
        userId,
      })
      return errorResponse(400, 'BAD_REQUEST', 'Invalid request body')
    }
    parsedBody = parsed.data
  } catch {
    parsedBody = {}
  }

  const apiKey = getServerSecret('GEMINI_API_KEY')
  if (!apiKey) {
    await logApiErrorEvent({
      endpoint: '/api/live-token',
      errorCode: 'UNAVAILABLE',
      statusCode: 503,
      message: 'Live service not available',
      requestId,
      userId,
    })
    return errorResponse(503, 'UNAVAILABLE', 'Live service not available')
  }

  const env = getServerEnv()

  const FALLBACK_SYSTEM_INSTRUCTION =
    'Sei un assistente AI per la salute e il benessere personale. ' +
    'Rispondi in italiano in modo naturale, conciso e conversazionale. ' +
    'Sei parte di un team multidisciplinare che include nutrizionisti, allenatori, medici e psicologi.'

  try {
    // Build context-aware system instruction (profile + history).
    // Wrapped in try-catch: if DB is unavailable (test env, cold-start error) we fall back
    // gracefully to a minimal prompt rather than blocking token creation.
    const liveCaseBootstrap = await getLiveCaseBootstrap(userId, parsedBody.conversationId).catch(
      async (err: unknown) => {
        console.error('[live-token] live case bootstrap failed, using null snapshot:', err)
        await logApiErrorEvent({
          endpoint: '/api/live-token',
          errorCode: 'FALLBACK_CASE_BOOTSTRAP',
          statusCode: 200,
          message: 'live case bootstrap failed, null snapshot used',
          requestId,
          userId,
          metadata: {
            fallbackPhase: 'CASE_BOOTSTRAP',
            cause:
              err instanceof Error
                ? { name: err.name, message: err.message }
                : { message: String(err) },
          },
        })
        return { activeAgentId: null, stateSnapshot: null }
      },
    )

    const systemInstruction = await buildLiveSystemInstruction(
      userId,
      parsedBody.conversationId,
    ).catch(async (err: unknown) => {
      console.error('[live-token] system instruction build failed, using fallback:', err)
      await logApiErrorEvent({
        endpoint: '/api/live-token',
        errorCode: 'FALLBACK_SYSTEM_INSTRUCTION',
        statusCode: 200,
        message: 'system instruction build failed, fallback prompt used',
        requestId,
        userId,
        metadata: {
          fallbackPhase: 'SYSTEM_INSTRUCTION_BUILD',
          cause:
            err instanceof Error
              ? { name: err.name, message: err.message }
              : { message: String(err) },
        },
      })
      return FALLBACK_SYSTEM_INSTRUCTION
    })

    // v1alpha is required for ephemeral token creation
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1alpha',
      httpOptions: { apiVersion: 'v1alpha' },
    } as ConstructorParameters<typeof GoogleGenAI>[0])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenClient = (ai as any).authTokens ?? (ai as any).tokens
    if (typeof tokenClient?.create !== 'function') {
      throw new Error('authTokens.create not available in this SDK version')
    }

    const ephemeral = (await tokenClient.create({
      config: {
        uses: 3,
        newSessionExpireTime: toIsoInMinutes(10),
        expireTime: toIsoInMinutes(40),
      },
    })) as { name?: string }

    const rawName = ephemeral?.name ?? ''
    if (!rawName) throw new Error('Empty ephemeral token received from Gemini')

    const token = normalizeEphemeralToken(rawName)

    return new Response(
      JSON.stringify({
        token,
        model: env.LIVE_MODEL,
        expiresAt: toIsoInMinutes(40),
        conversationId: parsedBody.conversationId ?? null,
        systemInstruction,
        stateSnapshot: liveCaseBootstrap.stateSnapshot,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to create live session token'
    await logApiErrorEvent({
      endpoint: '/api/live-token',
      errorCode: 'UNAVAILABLE',
      statusCode: 503,
      message: msg,
      requestId,
      userId,
    })
    return errorResponse(503, 'UNAVAILABLE', msg)
  }
}
