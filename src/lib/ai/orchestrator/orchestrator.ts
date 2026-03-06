import { AgentProfile, AgentInput, AgentProposal, ConsensusResult, Domain } from '../runtime-types'
import { detectDomainFromText } from '../domain/domainDetection'
import { selectAgentsForRequest, runConsensus } from '../consensus/consensusEngine'

export type LlmClient = {
  // Your Gemini provider (or mock) implements this.
  complete: (args: {
    system: string
    user: string
    jsonSchema?: unknown
    stream?: boolean
  }) => Promise<{ text: string }>
}

export type OrchestratorDeps = {
  llm: LlmClient
  team: AgentProfile[]
  orchestratorToolsAllowed: string[]
}

function buildAgentUserPrompt(input: AgentInput): string {
  return [
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
    ``,
    `INSTRUCTIONS:`,
    `- You are a specialist agent in a team-led system.`,
    `- Ask gating questions if key info is missing.`,
    `- Provide evidence-based recommendations. If uncertain, say so.`,
    `- Propose tool calls only if clearly helpful; do not claim execution.`,
  ].join('\n')
}

async function runOneAgent(
  llm: LlmClient,
  agent: AgentProfile,
  input: AgentInput,
): Promise<AgentProposal> {
  // Minimal JSON-ish protocol: agent writes a JSON object.
  const userPrompt = buildAgentUserPrompt(input)

  const res = await llm.complete({
    system: agent.systemPrompt,
    user: userPrompt,
  })

  // Try to parse JSON. Fallback to a safe proposal.
  try {
    const obj = JSON.parse(res.text)
    return {
      agentId: agent.id,
      domain: (obj.domain as Domain) ?? input.domainHint ?? 'general',
      summary: String(obj.summary ?? '').slice(0, 600),
      reasoning: String(obj.reasoning ?? '').slice(0, 4000),
      questions: Array.isArray(obj.questions) ? obj.questions.map(String).slice(0, 8) : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
      toolCalls: Array.isArray(obj.toolCalls) ? obj.toolCalls : [],
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.6,
      citations: Array.isArray(obj.citations) ? obj.citations : [],
      flags: obj.flags ?? {},
    }
  } catch {
    return {
      agentId: agent.id,
      domain: input.domainHint ?? 'general',
      summary: res.text.slice(0, 600),
      reasoning: res.text.slice(0, 4000),
      questions: [],
      recommendations: [],
      toolCalls: [],
      confidence: 0.4,
    }
  }
}

export async function orchestrate(
  deps: OrchestratorDeps,
  input: AgentInput,
): Promise<ConsensusResult> {
  const domainHint = input.domainHint ?? detectDomainFromText(input.message)

  const selectedAgents = selectAgentsForRequest(deps.team, domainHint, 4)
  const proposals = await Promise.all(
    selectedAgents.map((a) => runOneAgent(deps.llm, a, { ...input, domainHint })),
  )

  return runConsensus({
    opts: { orchestratorId: 'orchestrator', maxAgents: 4, requireGatingOnMissingInfo: true },
    team: deps.team,
    proposals,
    domainHint,
    contextPack: input.contextPack,
    orchestratorToolsAllowed: deps.orchestratorToolsAllowed,
  })
}
