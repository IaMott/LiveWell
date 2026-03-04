import type { ConversationContext, AIMessage, Domain, ProfileData } from './types'
import { classifyDomain } from './orchestrator'

const REQUIRED_DATA_BY_DOMAIN: Record<Domain, string[]> = {
  nutrizione: [
    'obiettivo',
    'età',
    'sesso',
    'peso',
    'altezza',
    'allergie_o_intolleranze',
    'patologie_o_farmaci',
    'routine_pasti',
    'idratazione',
    'attività_fisica_attuale',
  ],
  allenamento: [
    'obiettivo',
    'età',
    'sesso',
    'altezza',
    'peso',
    'livello_allenamento',
    'frequenza_allenamento',
    'infortuni_o_limitazioni',
    'attrezzatura_disponibile',
    'tempo_disponibile_settimanale',
  ],
  mindset: [
    'obiettivo',
    'stress_percepito',
    'ore_sonno',
    'ostacolo_principale',
    'tempo_disponibile_settimanale',
  ],
  cucina: [
    'obiettivo',
    'routine_pasti',
    'allergie_o_intolleranze',
    'attrezzatura_disponibile',
    'tempo_disponibile_settimanale',
  ],
  salute: [
    'sintomo_o_obiettivo_salute',
    'età',
    'sesso',
    'patologie_o_farmaci',
    'esami_recenti_o_referti',
  ],
  riabilitazione: [
    'obiettivo',
    'infortuni_o_limitazioni',
    'dolore_localizzazione',
    'dolore_intensità',
    'attività_fisica_attuale',
  ],
  generale: ['obiettivo'],
}

function ensureKnown(knownData: Record<string, string>, key: string, value: string | undefined) {
  if (!value || value.trim().length === 0) return
  knownData[key] = value.trim()
}

function extractConversationFacts(messages: AIMessage[], knownData: Record<string, string>) {
  for (const msg of messages.filter((m) => m.role === 'user')) {
    const content = msg.content.toLowerCase()

    const ageMatch = content.match(/(\d{1,2})\s*anni/)
    if (ageMatch) ensureKnown(knownData, 'età', `${ageMatch[1]} anni`)

    const weightMatch = content.match(/(\d{2,3})\s*(?:kg|chili|kili)/)
    if (weightMatch) ensureKnown(knownData, 'peso', `${weightMatch[1]} kg`)

    const heightMatch = content.match(/(\d{3})\s*(?:cm|centimetri)|(?:alto|alta)\s+(\d)[.,](\d{2})/)
    if (heightMatch) {
      ensureKnown(
        knownData,
        'altezza',
        heightMatch[1] ? `${heightMatch[1]} cm` : `${heightMatch[2]}.${heightMatch[3]} m`,
      )
    }

    if (/\buomo\b/.test(content)) ensureKnown(knownData, 'sesso', 'uomo')
    if (/\bdonna\b/.test(content)) ensureKnown(knownData, 'sesso', 'donna')

    const freqMatch = content.match(/(\d)\s*(?:volte|giorni)(?:\s*(?:a|alla|per)\s*settimana)/)
    if (freqMatch) ensureKnown(knownData, 'frequenza_allenamento', `${freqMatch[1]} volte/settimana`)

    if (content.includes('dimagrire') || content.includes('perdere peso')) {
      ensureKnown(knownData, 'obiettivo', 'perdita peso')
    } else if (content.includes('massa') || content.includes('muscoli')) {
      ensureKnown(knownData, 'obiettivo', 'aumento massa muscolare')
    } else if (content.includes('salute') || content.includes('stare bene')) {
      ensureKnown(knownData, 'obiettivo', 'benessere generale')
    }

    if (/allerg|intoller/.test(content)) ensureKnown(knownData, 'allergie_o_intolleranze', msg.content)
    if (/farmac|patologi|diagnos|malatti/.test(content)) ensureKnown(knownData, 'patologie_o_farmaci', msg.content)
    if (/colazione|pranzo|cena|spuntin|pasti/.test(content)) ensureKnown(knownData, 'routine_pasti', msg.content)
    if (/acqua|litri|idrataz/.test(content)) ensureKnown(knownData, 'idratazione', msg.content)
    if (/palestra|allen|corsa|sport/.test(content)) ensureKnown(knownData, 'attività_fisica_attuale', msg.content)
    if (/infortun|dolore|limitaz/.test(content)) ensureKnown(knownData, 'infortuni_o_limitazioni', msg.content)
    if (/attrez|manubr|bilanc|home gym|panca/.test(content)) ensureKnown(knownData, 'attrezzatura_disponibile', msg.content)
    if (/tempo|settiman|giorn/.test(content)) ensureKnown(knownData, 'tempo_disponibile_settimanale', msg.content)
    if (/stress|ansia|agitaz/.test(content)) ensureKnown(knownData, 'stress_percepito', msg.content)
    if (/sonno|dorm/.test(content)) ensureKnown(knownData, 'ore_sonno', msg.content)
    if (/ostacol|bloccat|fatica/.test(content)) ensureKnown(knownData, 'ostacolo_principale', msg.content)
    if (/sintom|pression|glicemi|colesterol|esami|refert/.test(content)) {
      ensureKnown(knownData, 'sintomo_o_obiettivo_salute', msg.content)
      ensureKnown(knownData, 'esami_recenti_o_referti', msg.content)
    }
    if (/dolore/.test(content)) ensureKnown(knownData, 'dolore_localizzazione', msg.content)
    const painMatch = content.match(/(\d{1,2})\s*\/\s*10/)
    if (painMatch) ensureKnown(knownData, 'dolore_intensità', `${painMatch[1]}/10`)
    if (/principiante|intermedio|avanzato/.test(content)) ensureKnown(knownData, 'livello_allenamento', msg.content)
  }
}

/**
 * Build conversation context from message history and user profile.
 * Merges DB profile data with data extracted from conversation.
 */
export function buildContext(
  messages: AIMessage[],
  userId: string,
  profileData?: ProfileData | null,
  existingDomain?: Domain,
  specialistMemory?: Record<string, string[]>,
): ConversationContext {
  // Determine domain from latest user message or existing
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const domain = existingDomain || (lastUserMsg ? classifyDomain(lastUserMsg.content) : 'generale')

  // Build known data from profile first
  const knownData: Record<string, string> = {}

  if (profileData) {
    if (profileData.birthDate) {
      const birth = new Date(profileData.birthDate)
      const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      if (age > 0 && age < 120) knownData['età'] = `${age} anni`
    }
    if (profileData.gender) ensureKnown(knownData, 'sesso', profileData.gender)
    if (profileData.height) ensureKnown(knownData, 'altezza', `${profileData.height} cm`)
    if (profileData.weight) ensureKnown(knownData, 'peso', `${profileData.weight} kg`)

    // Extract from JSON sections
    const health = profileData.health as Record<string, unknown> | null
    if (health) {
      if (health.conditions) ensureKnown(knownData, 'sintomo_o_obiettivo_salute', String(health.conditions))
      if (health.allergies) ensureKnown(knownData, 'allergie_o_intolleranze', String(health.allergies))
      if (health.medications) ensureKnown(knownData, 'patologie_o_farmaci', String(health.medications))
    }

    const nutrition = profileData.nutrition as Record<string, unknown> | null
    if (nutrition) {
      if (nutrition.dietType) ensureKnown(knownData, 'routine_pasti', String(nutrition.dietType))
      if (nutrition.intolerances) ensureKnown(knownData, 'allergie_o_intolleranze', String(nutrition.intolerances))
      if (nutrition.caloricGoal) ensureKnown(knownData, 'obiettivo', String(nutrition.caloricGoal))
    }

    const training = profileData.training as Record<string, unknown> | null
    if (training) {
      if (training.fitnessLevel) ensureKnown(knownData, 'livello_allenamento', String(training.fitnessLevel))
      if (training.weeklyDays) ensureKnown(knownData, 'frequenza_allenamento', `${training.weeklyDays} giorni/settimana`)
      if (training.injuries) ensureKnown(knownData, 'infortuni_o_limitazioni', String(training.injuries))
      if (training.sport) ensureKnown(knownData, 'attività_fisica_attuale', String(training.sport))
    }

    const mindfulness = profileData.mindfulness as Record<string, unknown> | null
    if (mindfulness) {
      if (mindfulness.stressLevel) ensureKnown(knownData, 'stress_percepito', String(mindfulness.stressLevel))
      if (mindfulness.sleepHours) ensureKnown(knownData, 'ore_sonno', `${mindfulness.sleepHours} ore`)
    }

    const goals = profileData.goals as Record<string, unknown> | null
    if (goals) {
      if (goals.shortTerm) ensureKnown(knownData, 'obiettivo', String(goals.shortTerm))
      if (goals.mediumTerm && !knownData.obiettivo) ensureKnown(knownData, 'obiettivo', String(goals.mediumTerm))
      if (goals.longTerm && !knownData.obiettivo) ensureKnown(knownData, 'obiettivo', String(goals.longTerm))
    }
  }

  // Override/complement with data extracted from conversation
  extractConversationFacts(messages, knownData)

  const requiredData = REQUIRED_DATA_BY_DOMAIN[domain] ?? REQUIRED_DATA_BY_DOMAIN.generale
  const missingData = requiredData.filter((key) => !knownData[key])

  return {
    messages,
    domain,
    knownData,
    missingData,
    requiredData,
    specialistMemory,
    riskSignal: 'none',
    userId,
    profileData: profileData || undefined,
  }
}
