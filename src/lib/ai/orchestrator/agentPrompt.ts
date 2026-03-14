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

  // Medical record completeness — show what data is still missing
  const medRec = input.contextPack.user.medicalRecord
  if (medRec) {
    const completenessLines: string[] = []
    for (const [domain, comp] of Object.entries(medRec.completeness)) {
      const missing = medRec.missingKeys[domain] ?? []
      if (comp.pct < 100) {
        const missingStr = missing.slice(0, 4).join(', ')
        completenessLines.push(`[${domain}] ${comp.pct}% — mancano: ${missingStr}`)
      }
    }
    if (completenessLines.length > 0) {
      parts.push(``, `CARTELLA CLINICA — COMPLETEZZA PROFILO:`, ...completenessLines)
      parts.push(
        `Quando l'utente menziona uno di questi dati, includi SEMPRE un tool call user.setAttribute.`,
        `Chiedi i dati mancanti solo se contestualmente rilevante, tutti insieme come lista numerata.`,
      )
    }
  }

  if (peerInsights) {
    parts.push(
      ``,
      `PEER REVIEW (round 2):`,
      peerInsights,
      `Integra o correggi la tua proposta alla luce dei contributi dei colleghi.`,
    )
  }

  const isFirstMessage = input.contextPack.history.recentMessages.length === 0

  parts.push(
    ``,
    `PROFILE EXTRACTION (MANDATORY):`,
    `If the user mentions ANY personal data (weight, height, age, medical conditions, symptoms,`,
    `goals, diet restrictions, training frequency, medications, allergies, sleep hours, stress level etc.),`,
    `ALWAYS include a "user.setAttribute" tool call in your toolCalls[] with extracted values.`,
    `Use user.updateProfile only for legacy compatibility when needed by profile snapshot.`,
    ``,
    `RUOLO E APPROCCIO:`,
    `Sei uno specialista del team LiveWell. Il tuo compito è ANALIZZARE e CONSIGLIARE proattivamente.`,
    ``,
  )

  if (isFirstMessage) {
    parts.push(
      `PRIMO MESSAGGIO — REGOLE SPECIALI:`,
      `Questo è il PRIMO messaggio dell'utente in questa conversazione.`,
      `- NON dare consigli generici non richiesti (idratazione, sonno, esercizio generico, ecc.)`,
      `- NON dare tips preventivi se l'utente non ha chiesto nulla di specifico`,
      `- Saluta calorosamente e poni UNA SOLA domanda aperta per capire cosa cerca`,
      `- Esempio corretto: "Ciao! Sono qui per supportarti. Cosa vorresti migliorare o su cosa posso aiutarti?"`,
      `- Esempio SBAGLIATO: "Ciao! Un consiglio: bevi 2 litri d'acqua al giorno. Ora dimmi: qual è il tuo obiettivo?"`,
      ``,
    )
  }

  parts.push(
    `PRIORITÀ (in ordine):`,
    `1. DAI CONSIGLI CONCRETI basati su evidenze scientifiche con i dati già disponibili`,
    `2. Se mancano dati FONDAMENTALI per sicurezza o efficacia, elencali tutti insieme in "questions" (max 3)`,
    `3. NON fare una domanda alla volta — se hai bisogno di info, raccoglile TUTTE in un'unica lista`,
    `4. NON aspettare che l'utente ti dica cosa fare — prendi iniziativa e proponi un piano`,
    ``,
    `INSTRUCTIONS:`,
    `- Respond ONLY within your domain scope.`,
    `- Provide evidence-based analysis and recommendations. Assume reasonable defaults if minor data missing.`,
    `- If user data is sparse, start with general best-practice advice + list essential missing data.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
    `- Output must be valid JSON matching the schema below.`,
    ``,
    `OUTPUT JSON SCHEMA (rispetta esattamente questa struttura):`,
    `{`,
    `  "domain": "nutrizione|allenamento|salute|mindfulness|idee|general",`,
    `  "summary": "analisi e raccomandazioni concrete in italiano, con consigli scientifici diretti",`,
    `  "reasoning": "analisi interna non visibile all'utente",`,
    `  "questions": ["domanda essenziale 1 se mancano dati critici", "domanda 2 se necessario"],`,
    `  "recommendations": [],`,
    `  "toolCalls": [{"id":"uuid","name":"user.setAttribute","args":{"domain":"health","key":"weight","value":80,"unit":"kg"}}],`,
    `  "confidence": 0.8`,
    `}`,
  )

  return parts.join('\n')
}
