import { AgentInput } from '../types'

export function formatUserAttributes(input: AgentInput): string[] {
  const attrs = input.contextPack.user.attributes
  if (!attrs) return []

  const lines: string[] = []
  for (const [domain, kv] of Object.entries(attrs)) {
    if (!kv || typeof kv !== 'object') continue
    const entries = Object.entries(kv as Record<string, { value: unknown; unit?: string }>)
      .slice(0, 8)
      .map(
        ([k, v]) =>
          `${k}: ${typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)}${v.unit ? ` ${v.unit}` : ''}`,
      )
    if (entries.length > 0) {
      lines.push(`[${domain}] ${entries.join(' | ')}`)
    }
  }
  return lines
}

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

export function buildAgentUserPrompt(
  input: AgentInput,
  agentId: string,
  peerInsights?: string,
): string {
  const parts: string[] = [
    `USER MESSAGE:`,
    input.message,
    ``,
    `CONTEXT (summary):`,
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

  const attributeLines = formatUserAttributes(input)
  if (attributeLines.length > 0) {
    parts.push(``, `USER ATTRIBUTES (fonte principale dinamica):`, ...attributeLines)
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

  if (peerInsights) {
    parts.push(
      ``,
      `PEER REVIEW (round 2):`,
      peerInsights,
      `Integra o correggi la tua proposta alla luce dei contributi dei colleghi.`,
    )
  }

  parts.push(
    ``,
    `PROFILE EXTRACTION (MANDATORY):`,
    `If the user mentions ANY personal data (weight, height, age, medical conditions, symptoms,`,
    `goals, diet restrictions, training frequency, medications, allergies, sleep hours, stress level etc.),`,
    `ALWAYS include a "user.setAttribute" tool call in your toolCalls[] with extracted values.`,
    `Use user.updateProfile only for legacy compatibility when needed by profile snapshot.`,
    ``,
    `NATURAL DIALOGUE RULE:`,
    `Non fare domande se puoi già rispondere in modo concreto.`,
    `Se manca un dato critico, fai al massimo UNA domanda mirata e solo su quel dato.`,
    ``,
    `INSTRUCTIONS:`,
    `- You are a specialist agent. Respond ONLY within your domain scope.`,
    `- Ask gating questions only for data YOUR specific domain requires.`,
    `- Provide evidence-based recommendations. If uncertain, say so.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
    `- Output must be valid JSON matching the schema below.`,
    ``,
    `OUTPUT JSON SCHEMA (rispetta esattamente questa struttura):`,
    `{`,
    `  "domain": "nutrizione|allenamento|salute|mindfulness|idee|general",`,
    `  "summary": "risposta diretta in italiano, termina con una domanda",`,
    `  "reasoning": "analisi interna non visibile all'utente",`,
    `  "questions": ["domanda gating se necessario"],`,
    `  "recommendations": [],`,
    `  "toolCalls": [{"id":"uuid","name":"user.setAttribute","args":{"domain":"health","key":"weight","value":80,"unit":"kg"}}],`,
    `  "confidence": 0.8`,
    `}`,
  )

  return parts.join('\n')
}
