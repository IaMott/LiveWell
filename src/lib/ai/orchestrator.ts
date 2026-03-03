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

  // Run consultation with support specialists
  const consultationNotes = await runConsultation(routing, context, enrichedMessage)

  const systemPrompt = await buildSpecialistPrompt(
    routing.primarySpecialist,
    { ...context, domain: routing.domain },
    consultationNotes,
  )

  const geminiMessages: AIMessage[] = [
    ...context.messages.slice(0, -1),
    { role: 'user', content: enrichedMessage },
  ]

  let content: string

  if (isGeminiConfigured()) {
    try {
      content = await generateResponse(systemPrompt, geminiMessages)
    } catch (err) {
      console.error('[Orchestrator] Gemini error, falling back to mock:', err)
      content = generateFallbackResponse(routing, enrichedMessage)
    }
  } else {
    content = generateFallbackResponse(routing, enrichedMessage)
  }

  return {
    content,
    specialist: routing.primarySpecialist,
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
): AsyncGenerator<{ type: 'routing'; data: { specialist: SpecialistId; audit: AIResponse['audit'] } } | { type: 'delta'; content: string }> {
  const routing = routeMessage(userMessage, context)
  const enrichedMessage = enrichMessage(userMessage, attachments)

  // Emit routing info first
  yield {
    type: 'routing',
    data: {
      specialist: routing.primarySpecialist,
      audit: {
        riskLevel: routing.riskLevel,
        pattern: routing.supportSpecialists.length > 0 ? 'multi-specialist' : 'direct',
        reasoning: routing.reasoning,
      },
    },
  }

  // Run internal consultation (non-streaming) with support specialists
  const consultationNotes = await runConsultation(routing, context, enrichedMessage)

  const systemPrompt = await buildSpecialistPrompt(
    routing.primarySpecialist,
    { ...context, domain: routing.domain },
    consultationNotes,
  )

  const geminiMessages: AIMessage[] = [
    ...context.messages.slice(0, -1),
    { role: 'user', content: enrichedMessage },
  ]

  if (isGeminiConfigured()) {
    try {
      const { generateStream } = await import('./gemini')
      for await (const chunk of generateStream(systemPrompt, geminiMessages)) {
        yield { type: 'delta', content: chunk }
      }
      return
    } catch (err) {
      console.error('[Orchestrator] Gemini stream error, falling back:', err)
    }
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
