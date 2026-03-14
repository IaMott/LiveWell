import { logApiErrorEvent } from '@/lib/monitoring/apiErrorEvents'
import type { ContextPack, Domain } from '@/lib/ai/types'

export type ChatFallbackPhase =
  | 'CONVERSATION_RESOLVE'
  | 'ORCHESTRATE_SAFE_RESPONSE'
  | 'TOOL_EXECUTION'
  | 'PERSIST_CHAT_TURN'

export async function logChatFallbackEvent(input: {
  phase: ChatFallbackPhase
  requestId: string
  userId: string
  message: string
  error?: unknown
  metadata?: Record<string, unknown>
}): Promise<void> {
  const err =
    input.error instanceof Error
      ? { name: input.error.name, message: input.error.message }
      : input.error
        ? { message: String(input.error) }
        : undefined

  await logApiErrorEvent({
    endpoint: '/api/chat/send',
    errorCode: `FALLBACK_${input.phase}`,
    statusCode: 200,
    message: input.message,
    requestId: input.requestId,
    userId: input.userId,
    metadata: {
      fallbackPhase: input.phase,
      ...(err ? { cause: err } : {}),
      ...(input.metadata ?? {}),
    },
  })
}

function hasPersonalData(
  contextPack: ContextPack,
  key: 'height' | 'weight' | 'birthDate',
): boolean {
  const personal = contextPack.user.attributes?.personal
  if (personal?.[key]?.value != null) return true
  const profile = contextPack.user.profile ?? {}
  return profile[key] != null
}

export function buildSafeFallbackResponse(
  message: string,
  contextPack: ContextPack,
  domain: Domain,
): string {
  const lower = message.toLowerCase()
  const greeting = /\b(ciao|salve|buongiorno|hey)\b/i.test(lower)
  if (greeting) return 'Ciao. Procediamo subito: dimmi in una frase il tuo obiettivo principale.'

  const asksAge = /\b(quanti anni|et[àa]|age)\b/i.test(lower)
  if (asksAge) {
    const birthDate =
      contextPack.user.attributes?.personal?.birthDate?.value ?? contextPack.user.profile?.birthDate
    if (!birthDate) {
      return 'Non ho la tua data di nascita registrata. Per calcolare la tua età indicami la data di nascita in formato gg/mm/aaaa.'
    }
  }

  if (domain === 'nutrition') {
    if (!hasPersonalData(contextPack, 'weight')) {
      return 'Per costruire un piano nutrizionale personalizzato mi manca solo il tuo peso attuale in kg.'
    }
    if (!hasPersonalData(contextPack, 'height')) {
      return 'Per costruire un piano nutrizionale personalizzato mi manca solo la tua altezza in cm.'
    }
    if (!hasPersonalData(contextPack, 'birthDate')) {
      return 'Per completare il piano nutrizionale mi manca solo la tua data di nascita (gg/mm/aaaa).'
    }
    return 'Ho già i dati essenziali. Dimmi il target concreto: quanti kg vuoi perdere e in quanto tempo.'
  }

  if (domain === 'training') {
    return 'Procediamo in modo pratico: indicami il sintomo o il limite principale su cui vuoi intervenire adesso.'
  }

  if (domain === 'health') {
    return 'Procediamo subito: indicami il sintomo principale, da quanto è presente e cosa lo peggiora.'
  }

  if (domain === 'mindfulness') {
    return 'Procediamo con un obiettivo concreto: preferisci lavorare su stress, sonno o ansia?'
  }

  return "Procediamo subito: dimmi l'obiettivo principale su cui vuoi lavorare ora."
}
