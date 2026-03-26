import type { AgentProposal, ContextPack } from '../types'

export function buildSummaries(proposals: AgentProposal[]): string {
  return proposals
    .filter((p) => p.summary)
    .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
    .map((p) => p.summary)
    .join('\n')
}

export function buildTopRecommendations(proposals: AgentProposal[]): string {
  return proposals
    .flatMap((p) => p.recommendations ?? [])
    .slice(0, 3)
    .map((r) => `• ${r.title}: ${r.steps.slice(0, 2).join('; ')}`)
    .join('\n')
}

export function buildRecentHistory(contextPack: ContextPack): string {
  return contextPack.history.recentMessages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content.slice(0, 400)}`)
    .join('\n')
}

/**
 * P4: Build an anti-repetition block listing the opening lines of the last
 * 3 assistant responses. This prevents the synthesis model from reusing the
 * same greeting/opener/structure across consecutive turns.
 */
export function buildAntiRepetitionBlock(contextPack: ContextPack): string {
  const assistantOpeners = contextPack.history.recentMessages
    .filter((m) => m.role === 'assistant')
    .slice(-3)
    .map((m) => {
      // Extract first non-empty sentence (up to 120 chars)
      const first = m.content.replace(/\s+/g, ' ').trim().slice(0, 120)
      return `"${first}…"`
    })
  if (assistantOpeners.length === 0) return ''
  return (
    `APERTURE GIÀ USATE NELLE ULTIME RISPOSTE (NON RIPETERE pattern simili):\n` +
    assistantOpeners.map((o) => `- ${o}`).join('\n')
  )
}

export function buildCrossConversationContext(contextPack: ContextPack): string {
  const summaries = contextPack.history.recentConversationSummaries
  if (!summaries || summaries.length === 0) return ''
  return summaries
    .slice(-5)
    .map((s) => `[${s.domain} — ${s.updatedAt.slice(0, 10)}] ${s.summary}`)
    .join('\n')
}

export function getUserName(contextPack: ContextPack): string | null {
  const profile = contextPack.user?.profile as Record<string, unknown> | undefined
  if (profile?.name && typeof profile.name === 'string') return profile.name.split(' ')[0] ?? null
  const attrs = contextPack.user?.attributes as
    | Record<string, Record<string, { value?: unknown }>>
    | undefined
  const personalName = attrs?.personal?.name?.value
  if (typeof personalName === 'string' && personalName.length > 0)
    return personalName.split(' ')[0] ?? null
  return null
}

export function buildStructuredProfileBlock(contextPack: ContextPack): string {
  const profile = (contextPack.user.profile ?? {}) as Record<string, unknown>
  const attrs = contextPack.user.attributes ?? {}
  const personal = (attrs.personal ?? {}) as Record<string, { value?: unknown }>
  const health = (attrs.health ?? {}) as Record<string, { value?: unknown }>
  const general = (attrs.general ?? {}) as Record<string, { value?: unknown }>

  const lines: string[] = []
  const val = (attrKey: string, ...profileKeys: string[]): unknown => {
    if (personal[attrKey]?.value != null) return personal[attrKey].value
    if (health[attrKey]?.value != null) return health[attrKey].value
    for (const pk of profileKeys) {
      if (profile[pk] != null && profile[pk] !== '') return profile[pk]
    }
    return null
  }

  const name = val('name', 'name')
  const gender = val('gender', 'gender')
  const age = val('age', 'age')
  const birthDate = val('birthDate', 'birthDate')
  const weight = val('weight', 'weight')
  const height = val('height', 'height')
  const goal = general?.goal?.value ?? general?.declared_goal?.value ?? profile.goal

  if (name) lines.push(`Nome: ${name}`)
  if (gender) lines.push(`Sesso: ${gender}`)
  if (birthDate) lines.push(`Data di nascita: ${birthDate}`)
  else if (age) lines.push(`Età osservata: ${age} anni`)
  if (height) lines.push(`Altezza: ${height} cm`)
  if (weight) lines.push(`Peso: ${weight} kg`)
  if (goal) lines.push(`Obiettivo: ${goal}`)

  if (lines.length === 0) return ''
  return `DATI PROFILO UTENTE (conferme già raccolte):\n${lines.join('\n')}`
}
