/**
 * Long-Term Memory — cross-conversation context.
 *
 * Salva e recupera riassunti di conversazioni precedenti per arricchire
 * il contesto dell'agente in nuove conversazioni.
 *
 * Il riassunto viene generato alla fine di ogni turn con ≥ 4 messaggi
 * usando una semplice euristica (non serve LLM call aggiuntiva).
 *
 * Struttura nel ContextPack:
 *   contextPack.history.recentConversationSummaries: ConvoSummary[]
 */

import { prisma } from '@/lib/prisma'

export type ConvoSummary = {
  conversationId: string
  summary: string
  domain: string
  updatedAt: Date
}

const MAX_SUMMARIES_IN_CONTEXT = 5
const MIN_MESSAGES_FOR_SUMMARY = 4

/**
 * Recupera gli ultimi N riassunti di conversazioni precedenti dell'utente.
 * Esclude la conversazione corrente.
 */
export async function getRecentConversationSummaries(
  userId: string,
  currentConversationId: string,
  limit = MAX_SUMMARIES_IN_CONTEXT,
): Promise<ConvoSummary[]> {
  try {
    const summaries = await prisma.conversationSummary.findMany({
      where: {
        userId,
        conversationId: { not: currentConversationId },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        conversationId: true,
        summary: true,
        domain: true,
        updatedAt: true,
      },
    })
    return summaries
  } catch {
    return []
  }
}

/**
 * Genera un riassunto testuale da una lista di messaggi.
 * Euristica: primo messaggio utente + ultima risposta assistant, max 280 chars.
 */
export function buildSummaryFromMessages(
  messages: Array<{ role: string; content: string }>,
  domain: string,
): string {
  const userMsgs = messages.filter((m) => m.role === 'user')
  const assistantMsgs = messages.filter((m) => m.role === 'assistant')

  const firstUser = userMsgs[0]?.content?.slice(0, 120) ?? ''
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1]?.content?.slice(0, 120) ?? ''

  const parts = [
    domain !== 'general' ? `[${domain}]` : '',
    firstUser ? `Q: ${firstUser}` : '',
    lastAssistant ? `A: ${lastAssistant}` : '',
  ].filter(Boolean)

  return parts.join(' — ').slice(0, 280)
}

/**
 * Upsert il riassunto per una conversazione (fire-and-forget).
 * Chiamato alla fine di ogni turn se il numero di messaggi supera la soglia.
 */
export function upsertConversationSummary(params: {
  userId: string
  conversationId: string
  messages: Array<{ role: string; content: string }>
  domain: string
  messageCount: number
}): void {
  if (params.messageCount < MIN_MESSAGES_FOR_SUMMARY) return

  const summary = buildSummaryFromMessages(params.messages, params.domain)
  if (!summary) return

  void prisma.conversationSummary
    .upsert({
      where: { conversationId: params.conversationId },
      create: {
        userId: params.userId,
        conversationId: params.conversationId,
        summary,
        domain: params.domain,
        messageCount: params.messageCount,
      },
      update: {
        summary,
        domain: params.domain,
        messageCount: params.messageCount,
      },
    })
    .catch((err: unknown) => {
      console.error('[longTermMemory] Failed to upsert summary:', err)
    })
}
