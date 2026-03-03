import type { ConversationContext, AIMessage, Domain, ProfileData } from './types'
import { classifyDomain } from './orchestrator'

/**
 * Build conversation context from message history and user profile.
 * Merges DB profile data with data extracted from conversation.
 */
export function buildContext(
  messages: AIMessage[],
  userId: string,
  profileData?: ProfileData | null,
  existingDomain?: Domain,
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
    if (profileData.gender) knownData['sesso'] = profileData.gender
    if (profileData.height) knownData['altezza'] = `${profileData.height} cm`
    if (profileData.weight) knownData['peso'] = `${profileData.weight} kg`

    // Extract from JSON sections
    const health = profileData.health as Record<string, unknown> | null
    if (health) {
      if (health.conditions) knownData['condizioni_salute'] = String(health.conditions)
      if (health.allergies) knownData['allergie'] = String(health.allergies)
      if (health.medications) knownData['farmaci'] = String(health.medications)
    }

    const nutrition = profileData.nutrition as Record<string, unknown> | null
    if (nutrition) {
      if (nutrition.dietType) knownData['tipo_dieta'] = String(nutrition.dietType)
      if (nutrition.intolerances) knownData['intolleranze'] = String(nutrition.intolerances)
      if (nutrition.caloricGoal) knownData['obiettivo_calorico'] = String(nutrition.caloricGoal)
    }

    const training = profileData.training as Record<string, unknown> | null
    if (training) {
      if (training.fitnessLevel) knownData['livello_fitness'] = String(training.fitnessLevel)
      if (training.weeklyDays) knownData['frequenza_allenamento'] = `${training.weeklyDays} giorni/settimana`
      if (training.injuries) knownData['infortuni'] = String(training.injuries)
      if (training.sport) knownData['sport'] = String(training.sport)
    }

    const mindfulness = profileData.mindfulness as Record<string, unknown> | null
    if (mindfulness) {
      if (mindfulness.stressLevel) knownData['livello_stress'] = String(mindfulness.stressLevel)
      if (mindfulness.sleepHours) knownData['ore_sonno'] = `${mindfulness.sleepHours} ore`
    }

    const goals = profileData.goals as Record<string, unknown> | null
    if (goals) {
      if (goals.shortTerm) knownData['obiettivo_breve'] = String(goals.shortTerm)
      if (goals.mediumTerm) knownData['obiettivo_medio'] = String(goals.mediumTerm)
      if (goals.longTerm) knownData['obiettivo_lungo'] = String(goals.longTerm)
    }
  }

  // Override/complement with data extracted from conversation
  const userMessages = messages.filter((m) => m.role === 'user')
  for (const msg of userMessages) {
    const content = msg.content.toLowerCase()

    const ageMatch = content.match(/(\d{1,2})\s*anni/)
    if (ageMatch) knownData['età'] = `${ageMatch[1]} anni`

    const weightMatch = content.match(/(\d{2,3})\s*(?:kg|chili|kili)/)
    if (weightMatch) knownData['peso'] = `${weightMatch[1]} kg`

    const heightMatch = content.match(/(\d{3})\s*(?:cm|centimetri)|(?:alto|alta)\s+(\d)[.,](\d{2})/)
    if (heightMatch) {
      knownData['altezza'] = heightMatch[1]
        ? `${heightMatch[1]} cm`
        : `${heightMatch[2]}.${heightMatch[3]} m`
    }

    const freqMatch = content.match(/(\d)\s*(?:volte|giorni)(?:\s*(?:a|alla|per)\s*settimana)/)
    if (freqMatch) knownData['frequenza_allenamento'] = `${freqMatch[1]} volte/settimana`

    if (content.includes('dimagrire') || content.includes('perdere peso')) {
      knownData['obiettivo'] = 'perdita peso'
    } else if (content.includes('massa') || content.includes('muscoli')) {
      knownData['obiettivo'] = 'aumento massa muscolare'
    } else if (content.includes('salute') || content.includes('stare bene')) {
      knownData['obiettivo'] = 'benessere generale'
    }
  }

  // Determine missing data based on domain
  const missingData: string[] = []
  if (domain === 'nutrizione') {
    if (!knownData['obiettivo']) missingData.push('obiettivo principale')
    if (!knownData['peso']) missingData.push('peso attuale')
    if (!knownData['altezza']) missingData.push('altezza')
    if (!knownData['età']) missingData.push('età')
  } else if (domain === 'allenamento') {
    if (!knownData['obiettivo']) missingData.push('obiettivo principale')
    if (!knownData['frequenza_allenamento']) missingData.push('frequenza allenamento settimanale')
  }

  return {
    messages,
    domain,
    knownData,
    missingData,
    riskSignal: 'none',
    userId,
    profileData: profileData || undefined,
  }
}
