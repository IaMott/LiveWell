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
import { buildSpecialistPrompt, buildOrchestratorPrompt } from './prompts'
import { generateResponse, isGeminiConfigured } from './gemini'

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
    generale: 'intervistatore',
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

/** Determine if conversation needs interview first */
function needsInterview(context: ConversationContext): boolean {
  if (context.messages.length <= 2) return true
  if (!context.domain || context.domain === 'generale') return true
  if (context.missingData.length > 2) return true
  return false
}

/** Main routing function */
export function routeMessage(
  message: string,
  context: ConversationContext,
): RoutingDecision {
  const riskLevel = triageRisk(message)
  const domain = context.domain || classifyDomain(message)
  const primary = selectSpecialist(domain, message)
  const interview = needsInterview(context)

  if (riskLevel === 'R2' || riskLevel === 'R3') {
    return {
      primarySpecialist: 'psicologo',
      supportSpecialists: ['mmg'],
      domain: 'mindset',
      riskLevel,
      reasoning: 'Red flag rilevato: routing a Psicologo con supporto MMG',
      needsInterview: false,
    }
  }

  if (interview && riskLevel === 'R0') {
    return {
      primarySpecialist: 'intervistatore',
      supportSpecialists: primary !== 'intervistatore' ? [primary] : [],
      domain,
      riskLevel,
      reasoning: `MVD incompleto: avvio intervista per dominio ${domain}`,
      needsInterview: true,
    }
  }

  return {
    primarySpecialist: primary,
    supportSpecialists: [],
    domain,
    riskLevel,
    reasoning: `Routing diretto a ${primary} per dominio ${domain}`,
    needsInterview: false,
  }
}

/** Generate AI response using orchestrator logic with Gemini */
export async function orchestrate(
  userMessage: string,
  context: ConversationContext,
  attachments?: AIMessage['attachments'],
): Promise<AIResponse> {
  const routing = routeMessage(userMessage, context)
  const systemPrompt = routing.needsInterview
    ? await buildSpecialistPrompt('intervistatore', { ...context, domain: routing.domain })
    : await buildSpecialistPrompt(routing.primarySpecialist, { ...context, domain: routing.domain })

  // Build attachment context into the user message
  let enrichedMessage = userMessage
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'barcode' && att.barcodeValue) {
        enrichedMessage += `\n[Codice a barre scansionato: ${att.barcodeValue}]`
      } else if (att.type === 'image') {
        enrichedMessage += `\n[Immagine allegata: ${att.fileName}]`
      }
    }
  }

  // Build messages for Gemini (conversation history + current message)
  const geminiMessages: AIMessage[] = [
    ...context.messages.slice(0, -1), // history without last (which is the current user msg)
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
      pattern: routing.needsInterview ? 'interview' : 'hub-and-spoke',
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
  const systemPrompt = routing.needsInterview
    ? await buildSpecialistPrompt('intervistatore', { ...context, domain: routing.domain })
    : await buildSpecialistPrompt(routing.primarySpecialist, { ...context, domain: routing.domain })

  // Enrich message with attachment context
  let enrichedMessage = userMessage
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'barcode' && att.barcodeValue) {
        enrichedMessage += `\n[Codice a barre scansionato: ${att.barcodeValue}]`
      } else if (att.type === 'image') {
        enrichedMessage += `\n[Immagine allegata: ${att.fileName}]`
      }
    }
  }

  const geminiMessages: AIMessage[] = [
    ...context.messages.slice(0, -1),
    { role: 'user', content: enrichedMessage },
  ]

  // Emit routing info first
  yield {
    type: 'routing',
    data: {
      specialist: routing.primarySpecialist,
      audit: {
        riskLevel: routing.riskLevel,
        pattern: routing.needsInterview ? 'interview' : 'hub-and-spoke',
        reasoning: routing.reasoning,
      },
    },
  }

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
  const { primarySpecialist, riskLevel, domain, needsInterview } = routing

  if (riskLevel === 'R2' || riskLevel === 'R3') {
    return (
      '🧠 **Psicologo del team LiveWell**\n\n' +
      'Ho notato nel tuo messaggio alcuni elementi che mi preoccupano. ' +
      'La tua sicurezza è la nostra priorità assoluta.\n\n' +
      'Ti consiglio di contattare:\n' +
      '- **Telefono Amico**: 02 2327 2327\n' +
      '- **Telefono Azzurro**: 19696\n' +
      '- **Pronto Soccorso** per emergenze immediate\n\n' +
      'Se vuoi, possiamo parlarne insieme in modo più approfondito. Sono qui per te.'
    )
  }

  if (needsInterview) {
    const domainIntros: Record<Domain, string> = {
      nutrizione: 'Per poterti aiutare al meglio con la nutrizione, avrei bisogno di conoscerti un po\' meglio.',
      allenamento: 'Per crearti un programma di allenamento efficace, vorrei capire meglio la tua situazione.',
      mindset: 'Per supportarti al meglio nel tuo percorso di crescita, vorrei farti qualche domanda.',
      cucina: 'Per darti consigli culinari su misura, vorrei capire le tue esigenze e possibilità.',
      salute: 'Per poterti orientare al meglio, avrei bisogno di alcune informazioni.',
      riabilitazione: 'Per aiutarti nel percorso di recupero, vorrei capire meglio la tua situazione.',
      generale: 'Benvenuto nel team LiveWell! Per aiutarti al meglio, vorrei capire cosa cerchi.',
    }
    const intro = domainIntros[domain] || domainIntros.generale
    return (
      `🎙️ **Intervistatore LiveWell**\n\n${intro}\n\n` +
      'Qual è il risultato più importante che vorresti ottenere nelle prossime settimane?'
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
  }

  const spec = specNames[primarySpecialist] || { emoji: '🤖', name: 'Assistente' }
  return (
    `${spec.emoji} **${spec.name} del team LiveWell**\n\n` +
    `Gemini AI non è configurato (GEMINI_API_KEY mancante). ` +
    `Il routing verso ${spec.name} per il dominio "${domain}" funziona correttamente. ` +
    `Configura GEMINI_API_KEY per attivare le risposte AI reali.`
  )
}

export { buildOrchestratorPrompt, buildSpecialistPrompt }
