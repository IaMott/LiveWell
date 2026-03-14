import { AgentProposal, ToolCall } from '../types'

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

export function mergeToolCalls(proposals: AgentProposal[], allowedTools: Set<string>): ToolCall[] {
  const out: ToolCall[] = []
  for (const p of proposals) {
    for (const c of p.toolCalls ?? []) {
      if (!allowedTools.has(c.name)) continue
      out.push(c)
    }
  }
  const seen = new Set<string>()
  return out.filter((c) => {
    const k = `${c.name}:${JSON.stringify(c.args)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
