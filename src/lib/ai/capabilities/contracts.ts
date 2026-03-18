export type ArtifactStorageType = 'nutrition' | 'training' | 'mindfulness' | 'other'

export type ArtifactContract = {
  kind: string
  storageType: ArtifactStorageType
  description: string
}

export type RuntimeCapabilityContract = {
  summary?: string
  canDo: string[]
  cannotDo: string[]
  consultTriggers: string[]
  handoffTriggers: string[]
  minimumInput: string[]
  outputContracts: string[]
  escalationRules: string[]
  allowedTools: string[]
  artifacts: ArtifactContract[]
}

function stripIndentation(markdown: string): string[] {
  return markdown.split('\n').map((line) => line.replace(/^\s{4}/, '').trimEnd())
}

function normalizeLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^---+$/.test(line))
}

function findHeadingStart(lines: string[], headings: string[]): number {
  const normalizedHeadings = headings.map((heading) => heading.toLowerCase())
  return lines.findIndex((line) =>
    normalizedHeadings.some((heading) => line.toLowerCase() === heading),
  )
}

function collectSection(lines: string[], headings: string | string[]): string[] {
  const aliases = Array.isArray(headings) ? headings : [headings]
  const start = findHeadingStart(lines, aliases)
  if (start === -1) return []
  const out: string[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.startsWith('## ')) break
    out.push(line)
  }
  return normalizeLines(out)
}

function collectBulletValues(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .map((line) => line.replace(/^`(.+)`$/, '$1'))
    .filter((line) => line.length > 0)
}

function inferArtifactContracts(agentId: string, markdown: string): ArtifactContract[] {
  const lowerAgentId = agentId.toLowerCase()
  const lower = markdown.toLowerCase()
  const contracts: ArtifactContract[] = []

  const push = (contract: ArtifactContract) => {
    if (contracts.some((existing) => existing.kind === contract.kind)) return
    contracts.push(contract)
  }

  if (
    lower.includes('ricett') ||
    lower.includes('menu') ||
    lowerAgentId.includes('chef') ||
    lowerAgentId.includes('diet')
  ) {
    push({
      kind: 'meal-plan',
      storageType: 'nutrition',
      description: 'Piani alimentari, menu o schede nutrizionali strutturate',
    })
  }

  if (lower.includes('allenamento') || lower.includes('riabilit') || lower.includes('workout')) {
    push({
      kind: 'training-plan',
      storageType: 'training',
      description: 'Schede allenamento, riabilitazione o programmazione motoria',
    })
  }

  if (lower.includes('mindfulness') || lower.includes('psicolog') || lower.includes('mental')) {
    push({
      kind: 'mindfulness-plan',
      storageType: 'mindfulness',
      description: 'Percorsi di mindfulness, supporto psicologico o coaching strutturato',
    })
  }

  if (
    lower.includes('report') ||
    lower.includes('analisi') ||
    lower.includes('valutazione') ||
    lower.includes('summary') ||
    lower.includes('orientamento')
  ) {
    push({
      kind: 'professional-report',
      storageType: 'other',
      description: 'Report, summary professionali, valutazioni strutturate o orientamenti',
    })
  }

  if (contracts.length === 0) {
    push({
      kind: 'recommendation-note',
      storageType: 'other',
      description: 'Raccomandazioni specialistiche strutturate',
    })
  }

  return contracts
}

function deriveConsultTriggers(cannotDo: string[], escalationRules: string[]): string[] {
  const combined = [...cannotDo, ...escalationRules]
  return combined.filter((line) =>
    /(->|co-gestione|specialista|specialisti|invio|fuori competenza|psicologo|medico|commercialista|avvocato)/i.test(
      line,
    ),
  )
}

function deriveHandoffTriggers(escalationRules: string[], cannotDo: string[]): string[] {
  return [...escalationRules, ...cannotDo].filter((line) =>
    /(dominio|fuori competenza|co-gestione|invio|specialista|specialisti|psicologo|medico)/i.test(
      line,
    ),
  )
}

export function parseCapabilityContract(
  agentId: string,
  markdown: string,
): RuntimeCapabilityContract {
  const lines = stripIndentation(markdown)
  const mission = collectSection(lines, '## Missione')
  const canDo = collectBulletValues(collectSection(lines, '## Cosa puoi fare'))
  const cannotDo = collectBulletValues(collectSection(lines, '## Cosa NON puoi fare'))
  const tools = collectBulletValues(
    collectSection(lines, [
      '## Tool suggeribili (allowlist, esecuzione server-side)',
      '## Tool suggeribili',
    ]),
  )
  const escalationRules = collectBulletValues(
    collectSection(lines, ['## Escalation rules', '## Escalation Rules']),
  )
  const inputExpected = collectBulletValues(
    collectSection(lines, ['## Input attesi dal ContextPack', '## Input attesi']),
  )
  const outputContracts = collectBulletValues(
    collectSection(lines, [
      "## Output contract verso l'orchestratore",
      '## Output contract',
      '## Output contract verso il team',
    ]),
  )

  return {
    summary: mission.join(' ').trim() || undefined,
    canDo,
    cannotDo,
    consultTriggers: deriveConsultTriggers(cannotDo, escalationRules),
    handoffTriggers: deriveHandoffTriggers(escalationRules, cannotDo),
    minimumInput: inputExpected,
    outputContracts,
    escalationRules,
    allowedTools: tools,
    artifacts: inferArtifactContracts(agentId, markdown),
  }
}
