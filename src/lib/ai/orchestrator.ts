import type {
  SpecialistId,
  Domain,
  RiskLevel,
  RoutingDecision,
  ConversationContext,
  AIMessage,
  AIResponse,
} from './types'
import { specialists } from './specialists'
import { buildSpecialistPrompt, buildConsultationPrompt } from './prompts'
import { generateResponse, isGeminiConfigured } from './gemini'

/** Max internal consultation rounds between specialists */
const MAX_CONSULTATION_ROUNDS = 3

// --- Red flag patterns for risk triage ---
const RED_FLAG_PATTERNS = [
  /suicid/i, /ucciderm/i, /ammazzarm/i, /farla finita/i,
  /non voglio più vivere/i, /morire/i, /autolesion/i, /tagli/i,
  /vomit.*dopo.*mangiato/i, /purg/i, /lassativ.*dimagr/i,
  /non mangio.*giorni/i, /sveniment/i, /dolore.*petto.*forte/i,
  /sangue.*feci/i, /sangue.*urina/i,
]

const POSSIBLE_RISK_PATTERNS = [
  /disturbo alimentare/i, /anoressia/i, /bulimia/i, /binge/i,
  /abbuffat/i, /ossession.*cibo/i, /ossession.*peso/i,
  /depresso/i, /depressione/i, /ansia.*grave/i, /panico/i,
  /infortunio.*grave/i, /frattura/i, /operazione/i, /chirurgia/i,
]

const MVD_QUESTIONS: Record<string, string> = {
  obiettivo: 'Per iniziare bene, qual e il risultato concreto che vuoi ottenere nei prossimi 3 mesi?',
  età: 'Mi confermi la tua eta?',
  sesso: 'Mi confermi il tuo sesso biologico (uomo o donna)?',
  peso: 'Mi dici il tuo peso attuale in kg?',
  altezza: 'Mi dici la tua altezza in cm?',
  allergie_o_intolleranze: 'Hai allergie o intolleranze alimentari da considerare?',
  patologie_o_farmaci: 'Hai patologie diagnosticate o farmaci in uso che dobbiamo considerare?',
  routine_pasti: 'Com e organizzata oggi la tua routine dei pasti durante la giornata?',
  idratazione: 'Quanta acqua bevi mediamente in un giorno?',
  attività_fisica_attuale: 'Che attivita fisica stai facendo adesso e con quale frequenza?',
  livello_allenamento: 'Come valuti il tuo livello attuale di allenamento (principiante/intermedio/avanzato)?',
  frequenza_allenamento: 'Quanti giorni a settimana riesci ad allenarti in modo realistico?',
  infortuni_o_limitazioni: 'Hai infortuni o limitazioni fisiche attive da rispettare?',
  attrezzatura_disponibile: 'Che attrezzatura hai a disposizione per allenarti/cucinare?',
  tempo_disponibile_settimanale: 'Quanto tempo reale hai ogni settimana da dedicare al percorso?',
  stress_percepito: 'Quanto ti senti stressato in questo periodo, anche in modo indicativo?',
  ore_sonno: 'Quante ore dormi mediamente per notte?',
  ostacolo_principale: 'Qual e l ostacolo principale che ti fa perdere continuita?',
  sintomo_o_obiettivo_salute: 'Qual e il sintomo o l obiettivo di salute principale su cui vuoi lavorare?',
  esami_recenti_o_referti: 'Hai esami recenti o referti utili da considerare?',
  dolore_localizzazione: 'Dove senti dolore o fastidio in questo momento?',
  dolore_intensità: 'Quanto e intenso il dolore da 0 a 10?',
}

interface SpecialistTurn {
  specialistId: SpecialistId
  content: string
}

/** Triage risk level from message content */
export function triageRisk(message: string): RiskLevel {
  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.test(message)) return 'R2'
  }
  for (const pattern of POSSIBLE_RISK_PATTERNS) {
    if (pattern.test(message)) return 'R1'
  }
  return 'R0'
}

/** Classify domain from message using keyword matching */
export function classifyDomain(message: string): Domain {
  const lower = message.toLowerCase()
  const scores: Record<Domain, number> = {
    nutrizione: 0,
    allenamento: 0,
    mindset: 0,
    cucina: 0,
    salute: 0,
    riabilitazione: 0,
    generale: 0,
  }

  for (const spec of specialists) {
    for (const keyword of spec.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        for (const domain of spec.domains) {
          scores[domain] += 1
        }
      }
    }
  }

  let maxDomain: Domain = 'generale'
  let maxScore = 0
  for (const [domain, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      maxDomain = domain as Domain
    }
  }

  return maxDomain
}

/** Select the best specialist for a domain */
export function selectSpecialist(domain: Domain, message: string): SpecialistId {
  const lower = message.toLowerCase()

  const domainMap: Record<Domain, SpecialistId> = {
    nutrizione: 'dietista',
    allenamento: 'personal_trainer',
    mindset: 'mental_coach',
    cucina: 'chef',
    salute: 'mmg',
    riabilitazione: 'fisioterapista',
    generale: 'analista_contesto',
  }

  if (domain === 'mindset') {
    const clinicalKeywords = ['ansia', 'depressione', 'panico', 'trauma', 'fobia', 'ossessione', 'disturbo', 'terapia']
    if (clinicalKeywords.some((k) => lower.includes(k))) {
      return 'psicologo'
    }
  }

  if (domain === 'salute') {
    const giKeywords = ['stomaco', 'intestino', 'digestione', 'reflusso', 'gastrite', 'colite', 'gonfiore']
    if (giKeywords.some((k) => lower.includes(k))) return 'gastroenterologo'

    const sportKeywords = ['infortunio sportivo', 'idoneità', 'vo2max', 'performance atletica']
    if (sportKeywords.some((k) => lower.includes(k))) return 'medico_sport'
  }

  if (domain === 'riabilitazione') {
    const movementKeywords = ['biomeccanica', 'catena cinetica', 'analisi movimento', 'gesto atletico']
    if (movementKeywords.some((k) => lower.includes(k))) return 'chinesologo'

    const medicalKeywords = ['diagnosi', 'radiografia', 'risonanza', 'farmaco', 'terapia fisica']
    if (medicalKeywords.some((k) => lower.includes(k))) return 'fisiatra'
  }

  return domainMap[domain]
}

/** Determine support specialists that should be consulted */
function selectSupportSpecialists(domain: Domain, primary: SpecialistId, message: string): SpecialistId[] {
  const lower = message.toLowerCase()
  const support: SpecialistId[] = []

  // Cross-domain routing: nutrition + training often go together
  if (domain === 'nutrizione' && (lower.includes('allena') || lower.includes('palestra') || lower.includes('sport'))) {
    if (primary !== 'personal_trainer') support.push('personal_trainer')
  }
  if (domain === 'allenamento' && (lower.includes('dieta') || lower.includes('mangiare') || lower.includes('alimentazione'))) {
    if (primary !== 'dietista') support.push('dietista')
  }

  // Rehabilitation often needs both physio + fisiatra
  if (domain === 'riabilitazione') {
    if (primary === 'fisioterapista') support.push('fisiatra')
    else if (primary === 'fisiatra') support.push('fisioterapista')
  }

  // Mental health: psicologo + mental_coach complement each other
  if (domain === 'mindset') {
    if (primary === 'psicologo') support.push('mental_coach')
    else if (primary === 'mental_coach' && (lower.includes('stress') || lower.includes('ansia'))) {
      support.push('psicologo')
    }
  }

  // Cooking + nutrition
  if (domain === 'cucina' && (lower.includes('dieta') || lower.includes('calorie') || lower.includes('sano'))) {
    support.push('dietista')
  }

  return support.slice(0, 2) // Max 2 support specialists
}

function formatContributorName(id: SpecialistId): string {
  const labels: Record<SpecialistId, string> = {
    orchestratore: 'Orchestratore',
    intervistatore: 'Intervistatore',
    dietista: 'Dietista',
    personal_trainer: 'Personal Trainer',
    psicologo: 'Psicologo',
    mental_coach: 'Mental Coach',
    chef: 'Chef',
    fisioterapista: 'Fisioterapista',
    fisiatra: 'Fisiatra',
    medico_sport: 'Medico dello Sport',
    mmg: 'MMG',
    gastroenterologo: 'Gastroenterologo',
    chinesologo: 'Chinesologo',
    analista_contesto: 'Analista del Contesto',
  }
  return labels[id]
}

function dedupeSpecialists(ids: SpecialistId[]): SpecialistId[] {
  return [...new Set(ids)]
}

function buildContributorFooter(contributors: SpecialistId[]): string {
  if (contributors.length === 0) return ''
  const names = contributors.map(formatContributorName).join(', ')
  return `\n\nRiferimenti professionali integrati: ${names}.`
}

function buildMvdQuestion(context: ConversationContext): string {
  const nextMissing = context.missingData[0]
  if (!nextMissing) {
    return 'Procediamo: dimmi pure il prossimo dettaglio che vuoi approfondire.'
  }
  return MVD_QUESTIONS[nextMissing] ?? `Per completare il quadro mi serve un dato: ${nextMissing}.`
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function looksLikeStructuredOutput(text: string): boolean {
  const clean = stripCodeFences(text)
  return clean.startsWith('{') && (clean.includes('"final_report"') || clean.includes('"audit_log"'))
}

function extractNaturalFromStructuredJson(text: string): string | null {
  try {
    const clean = stripCodeFences(text)
    const parsed = JSON.parse(clean) as {
      final_report?: {
        summary?: string
        recommendations?: string[]
      }
    }
    const summary = parsed.final_report?.summary?.trim()
    if (!summary) return null
    const recommendations = (parsed.final_report?.recommendations ?? [])
      .slice(0, 3)
      .map((item) => `- ${item}`)
      .join('\n')
    return recommendations
      ? `${summary}\n\nProssimi passi consigliati:\n${recommendations}`
      : summary
  } catch {
    return null
  }
}

function normalizeAssistantOutput(content: string): string {
  const trimmed = content.trim()
  let normalized = trimmed
  if (looksLikeStructuredOutput(trimmed)) {
    normalized =
      extractNaturalFromStructuredJson(trimmed) ??
      'Procediamo in modo diretto: ti rispondo in linguaggio naturale e continuo, senza formato tecnico.'
  }
  // Block fake handoff wording.
  normalized = normalized
    .replace(/passo la palla[^.\n]*[.\n]?/gi, '')
    .replace(/passo il testimone[^.\n]*[.\n]?/gi, '')
    .replace(/il personal trainer[^.\n]*pronto[^.\n]*[.\n]?/gi, '')
    .replace(/ha preso in carico[^.\n]*[.\n]?/gi, '')
    .replace(/ora (ti )?risponder[aà] [^.\n]*[.\n]?/gi, '')
    .replace(/attendi[^.\n]*[.\n]?/gi, '')
    .trim()
  if (!normalized) {
    normalized = 'Procediamo subito con indicazioni concrete, senza attese o passaggi fittizi.'
  }
  return normalized
}

function enforceSingleQuestion(content: string): string {
  const questionMatches = [...content.matchAll(/\?/g)]
  if (questionMatches.length <= 1) return content
  const firstQuestionPos = questionMatches[0]?.index ?? -1
  if (firstQuestionPos < 0) return content
  return content.slice(0, firstQuestionPos + 1).trim()
}

async function runSpecialist(
  specialistId: SpecialistId,
  context: ConversationContext,
  enrichedMessage: string,
  consultationNotes?: string,
): Promise<string> {
  const memory = context.specialistMemory?.[specialistId]
  const memoryBlock =
    memory && memory.length > 0
      ? `\n\n[Memoria interna ${formatContributorName(specialistId)}]\n${memory.slice(-5).join('\n')}`
      : ''
  const systemPrompt = await buildSpecialistPrompt(
    specialistId,
    { ...context, domain: context.domain },
    consultationNotes,
  )
  const geminiMessages: AIMessage[] = [
    ...context.messages.slice(0, -1),
    { role: 'user', content: `${enrichedMessage}${memoryBlock}` },
  ]
  const output = isGeminiConfigured()
    ? await generateResponse(systemPrompt, geminiMessages)
    : generateFallbackResponse(
        {
          primarySpecialist: specialistId,
          supportSpecialists: [],
          domain: context.domain ?? 'generale',
          riskLevel: 'R0',
          reasoning: 'fallback',
        },
        enrichedMessage,
      )
  return enforceSingleQuestion(normalizeAssistantOutput(output))
}

async function runContributorsSequentially(
  contributors: SpecialistId[],
  context: ConversationContext,
  enrichedMessage: string,
  consultationNotes: string,
): Promise<SpecialistTurn[]> {
  const turns: SpecialistTurn[] = []
  for (const specialistId of contributors) {
    try {
      const content = await runSpecialist(
        specialistId,
        context,
        enrichedMessage,
        specialistId === contributors[0] ? consultationNotes : undefined,
      )
      turns.push({ specialistId, content })
    } catch (err) {
      console.error(`[Orchestrator] Specialist turn error for ${specialistId}:`, err)
    }
  }
  return turns
}

async function buildMultiAgentPanelResponse(
  contributors: SpecialistId[],
  context: ConversationContext,
  enrichedMessage: string,
  consultationNotes: string,
): Promise<string> {
  const turns = await runContributorsSequentially(
    contributors,
    context,
    enrichedMessage,
    consultationNotes,
  )
  const parts = turns.map((turn) => `${formatContributorName(turn.specialistId)}: ${turn.content}`)
  if (parts.length === 0) {
    return 'Procediamo insieme: dimmi il prossimo dettaglio e costruisco una risposta completa con il team.'
  }
  return parts.join('\n\n')
}

/** Main routing function */
export function routeMessage(
  message: string,
  context: ConversationContext,
): RoutingDecision {
  const riskLevel = triageRisk(message)
  const domain = context.domain || classifyDomain(message)
  const primary = selectSpecialist(domain, message)

  if (riskLevel === 'R2' || riskLevel === 'R3') {
    return {
      primarySpecialist: 'psicologo',
      supportSpecialists: ['mmg'],
      domain: 'mindset',
      riskLevel,
      reasoning: 'Red flag rilevato: routing a Psicologo con supporto MMG',
    }
  }

  if (context.missingData.length > 0) {
    return {
      primarySpecialist: 'intervistatore',
      supportSpecialists: [],
      domain,
      riskLevel,
      reasoning: `MVD incompleto (${context.missingData.length} dati mancanti): intervista guidata prima del piano`,
    }
  }

  const support = selectSupportSpecialists(domain, primary, message)

  return {
    primarySpecialist: primary,
    supportSpecialists: support,
    domain,
    riskLevel,
    reasoning: support.length > 0
      ? `Consulto team: ${primary} (primario) + ${support.join(', ')} per dominio ${domain}`
      : `Routing a ${primary} per dominio ${domain}`,
  }
}

/** Run multi-specialist consultation (non-streaming, internal) */
async function runConsultation(
  routing: RoutingDecision,
  context: ConversationContext,
  enrichedMessage: string,
): Promise<string> {
  if (routing.supportSpecialists.length === 0 || !isGeminiConfigured()) {
    return ''
  }

  const consultations: string[] = []

  for (const supportId of routing.supportSpecialists) {
    try {
      const supportPrompt = await buildConsultationPrompt(supportId, context, routing.primarySpecialist)
      const geminiMessages: AIMessage[] = [
        ...context.messages.slice(0, -1),
        { role: 'user', content: enrichedMessage },
      ]

      let opinion = ''
      for (let round = 0; round < MAX_CONSULTATION_ROUNDS; round++) {
        opinion = await generateResponse(supportPrompt, geminiMessages)
        // If the opinion is substantial (not just "ok" or very short), use it
        if (opinion.length > 30) break
      }

      if (opinion) {
        consultations.push(`[Parere di ${supportId}]: ${opinion}`)
      }
    } catch (err) {
      console.error(`[Orchestrator] Consultation error for ${supportId}:`, err)
    }
  }

  return consultations.join('\n\n')
}

/** Enrich message with attachment descriptions */
function enrichMessage(
  userMessage: string,
  attachments?: AIMessage['attachments'],
): string {
  let enriched = userMessage
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'barcode' && att.barcodeValue) {
        enriched += `\n[Codice a barre scansionato: ${att.barcodeValue}]`
      } else if (att.type === 'image') {
        enriched += `\n[Immagine allegata: ${att.fileName}]`
      } else if (att.type === 'audio') {
        enriched += `\n[Messaggio vocale allegato: ${att.fileName}]`
      }
    }
  }
  return enriched
}

/** Generate AI response using orchestrator logic with Gemini */
export async function orchestrate(
  userMessage: string,
  context: ConversationContext,
  attachments?: AIMessage['attachments'],
): Promise<AIResponse> {
  const routing = routeMessage(userMessage, context)
  const enrichedMessage = enrichMessage(userMessage, attachments)
  const contributors = dedupeSpecialists([
    routing.primarySpecialist,
    ...routing.supportSpecialists,
  ])

  if (routing.primarySpecialist === 'intervistatore' && context.missingData.length > 0) {
    const content = buildMvdQuestion(context)
    return {
      content,
      specialist: 'intervistatore',
      contributors: ['intervistatore'],
      audit: {
        riskLevel: routing.riskLevel,
        pattern: 'mvd-gating',
        reasoning: routing.reasoning,
      },
    }
  }

  // Run consultation with support specialists
  const consultationNotes = await runConsultation(routing, context, enrichedMessage)
  let content: string
  try {
    content =
      contributors.length > 1
        ? await buildMultiAgentPanelResponse(
            contributors,
            { ...context, domain: routing.domain },
            enrichedMessage,
            consultationNotes,
          )
        : await runSpecialist(
            routing.primarySpecialist,
            { ...context, domain: routing.domain },
            enrichedMessage,
            consultationNotes,
          )
  } catch (err) {
    console.error('[Orchestrator] Gemini error, falling back to mock:', err)
    content = generateFallbackResponse(routing, enrichedMessage)
  }

  return {
    content: content + buildContributorFooter(contributors),
    specialist: routing.primarySpecialist,
    contributors,
    audit: {
      riskLevel: routing.riskLevel,
      pattern: routing.supportSpecialists.length > 0 ? 'multi-specialist' : 'direct',
      reasoning: routing.reasoning,
    },
  }
}

/** Streaming orchestrate — yields text chunks from Gemini */
export async function* orchestrateStream(
  userMessage: string,
  context: ConversationContext,
  attachments?: AIMessage['attachments'],
): AsyncGenerator<
  | {
      type: 'routing'
      data: {
        specialist: SpecialistId
        specialists: SpecialistId[]
        domain: Domain
        mode: 'interview' | 'integrated'
        audit: AIResponse['audit']
      }
    }
  | { type: 'agent_turn'; specialist: SpecialistId }
  | { type: 'agent_delta'; specialist: SpecialistId; content: string }
  | { type: 'agent_done'; specialist: SpecialistId }
  | { type: 'delta'; content: string }
> {
  const routing = routeMessage(userMessage, context)
  const enrichedMessage = enrichMessage(userMessage, attachments)
  const contributors = dedupeSpecialists([
    routing.primarySpecialist,
    ...routing.supportSpecialists,
  ])
  const isInterview = routing.primarySpecialist === 'intervistatore' && context.missingData.length > 0

  // Emit routing info first
  yield {
    type: 'routing',
    data: {
      specialist: routing.primarySpecialist,
      specialists: contributors,
      domain: routing.domain,
      mode: isInterview ? 'interview' : 'integrated',
      audit: {
        riskLevel: routing.riskLevel,
        pattern: routing.supportSpecialists.length > 0 ? 'multi-specialist' : 'direct',
        reasoning: routing.reasoning,
      },
    },
  }

  if (isInterview) {
    yield { type: 'delta', content: buildMvdQuestion(context) }
    return
  }

  // Run internal consultation (non-streaming) with support specialists
  const consultationNotes = await runConsultation(routing, context, enrichedMessage)

  try {
    const turns = await runContributorsSequentially(
      contributors,
      { ...context, domain: routing.domain },
      enrichedMessage,
      consultationNotes,
    )
    if (turns.length > 0) {
      for (const turn of turns) {
        yield { type: 'agent_turn', specialist: turn.specialistId }
        for (const chunk of turn.content.split(/(\s+)/).filter(Boolean)) {
          yield { type: 'agent_delta', specialist: turn.specialistId, content: chunk }
        }
        yield { type: 'agent_done', specialist: turn.specialistId }
      }
      return
    }
  } catch (err) {
    console.error('[Orchestrator] Gemini stream error, falling back:', err)
  }

  // Fallback: yield mock response word by word
  const fallback = generateFallbackResponse(routing, enrichedMessage)
  const words = fallback.split(' ')
  for (const word of words) {
    yield { type: 'delta', content: word + ' ' }
  }
}

/** Fallback response when Gemini is not available */
function generateFallbackResponse(
  routing: RoutingDecision,
  _enrichedMessage: string,
): string {
  const { primarySpecialist, riskLevel, domain } = routing

  if (riskLevel === 'R2' || riskLevel === 'R3') {
    return (
      'Ho notato nel tuo messaggio alcuni elementi che mi preoccupano. ' +
      'La tua sicurezza è la nostra priorità assoluta.\n\n' +
      'Ti consiglio di contattare:\n' +
      '- **Telefono Amico**: 02 2327 2327\n' +
      '- **Telefono Azzurro**: 19696\n' +
      '- **Pronto Soccorso** per emergenze immediate\n\n' +
      'Se vuoi, possiamo parlarne insieme in modo più approfondito. Sono qui per te.'
    )
  }

  const specNames: Partial<Record<SpecialistId, { emoji: string; name: string }>> = {
    dietista: { emoji: '🥗', name: 'Dietista' },
    personal_trainer: { emoji: '💪', name: 'Personal Trainer' },
    psicologo: { emoji: '🧠', name: 'Psicologo' },
    mental_coach: { emoji: '🎯', name: 'Mental Coach' },
    chef: { emoji: '👨‍🍳', name: 'Chef' },
    fisioterapista: { emoji: '🦴', name: 'Fisioterapista' },
    fisiatra: { emoji: '⚕️', name: 'Fisiatra' },
    medico_sport: { emoji: '🏅', name: 'Medico dello Sport' },
    mmg: { emoji: '🩺', name: 'Medico di Medicina Generale' },
    gastroenterologo: { emoji: '🫁', name: 'Gastroenterologo' },
    chinesologo: { emoji: '🤸', name: 'Chinesologo' },
    analista_contesto: { emoji: '🔍', name: 'Analista del Contesto' },
  }

  const spec = specNames[primarySpecialist] || { emoji: '🤖', name: 'Assistente' }
  return (
    `Gemini AI non è configurato (GEMINI_API_KEY mancante). ` +
    `Il routing verso ${spec.name} per il dominio "${domain}" funziona correttamente. ` +
    `Configura GEMINI_API_KEY per attivare le risposte AI reali.`
  )
}

export { buildSpecialistPrompt }
