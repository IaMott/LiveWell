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

const DOMAIN_ARTIFACT_MAP: Record<string, ArtifactContract[]> = {
  nutrition: [
    {
      kind: 'meal-plan',
      storageType: 'nutrition',
      description: 'Piani alimentari, menu o schede nutrizionali strutturate',
    },
  ],
  training: [
    {
      kind: 'training-plan',
      storageType: 'training',
      description: 'Schede allenamento, riabilitazione o programmazione motoria',
    },
  ],
  mindfulness: [
    {
      kind: 'mindfulness-plan',
      storageType: 'mindfulness',
      description: 'Percorsi di mindfulness, supporto psicologico o coaching strutturato',
    },
  ],
  health: [
    {
      kind: 'professional-report',
      storageType: 'other',
      description: 'Report, valutazioni strutturate o orientamenti professionali',
    },
  ],
  inspiration: [
    {
      kind: 'professional-report',
      storageType: 'other',
      description: 'Report, valutazioni strutturate o orientamenti professionali',
    },
  ],
  general: [
    {
      kind: 'recommendation-note',
      storageType: 'other',
      description: 'Raccomandazioni specialistiche strutturate',
    },
  ],
  coordination: [
    {
      kind: 'recommendation-note',
      storageType: 'other',
      description: 'Raccomandazioni specialistiche strutturate',
    },
  ],
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

function collectDeclaredDomains(markdown: string): string[] {
  const missionBlock = collectSection(stripIndentation(markdown), '## Missione')
  const mission = missionBlock.join(' ').toLowerCase()
  const domains = Object.keys(DOMAIN_ARTIFACT_MAP).filter((domain) => mission.includes(domain))
  return domains.length > 0 ? domains : ['general']
}

function inferArtifactContracts(
  _agentId: string,
  markdown: string,
  allowedTools: string[],
): ArtifactContract[] {
  const contracts: ArtifactContract[] = []

  const push = (contract: ArtifactContract) => {
    if (contracts.some((existing) => existing.kind === contract.kind)) return
    contracts.push(contract)
  }

  for (const domain of collectDeclaredDomains(markdown)) {
    for (const contract of DOMAIN_ARTIFACT_MAP[domain] ?? []) push(contract)
  }

  for (const tool of allowedTools) {
    if (tool.startsWith('nutrition.')) {
      for (const contract of DOMAIN_ARTIFACT_MAP.nutrition) push(contract)
    }
    if (tool.startsWith('training.')) {
      for (const contract of DOMAIN_ARTIFACT_MAP.training) push(contract)
    }
    if (tool.startsWith('mindfulness.')) {
      for (const contract of DOMAIN_ARTIFACT_MAP.mindfulness) push(contract)
    }
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
  const artifacts = inferArtifactContracts(agentId, markdown, tools)

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
    artifacts,
  }
}
