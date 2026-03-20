import type { AgentProfile, Domain } from '../types'
import type { ArtifactStorageType, RuntimeCapabilityContract } from './contracts'

const ARTIFACT_DOMAIN_MAP: Partial<Record<ArtifactStorageType, Domain[]>> = {
  nutrition: ['nutrition'],
  training: ['training', 'health'],
  mindfulness: ['mindfulness', 'health'],
}

const DOMAIN_TRIGGER_KEYWORDS: Record<Domain, string[]> = {
  general: [],
  nutrition: ['nutrition', 'nutriz', 'dieta', 'dietista', 'chef', 'gastro'],
  health: [
    'health',
    'salute',
    'medic',
    'sintomi',
    'clin',
    'fisiatra',
    'mmg',
    'cardi',
    'dolore',
    'toracic',
    'petto',
    'fiato corto',
    'dispnea',
    'palpit',
  ],
  training: ['training', 'allen', 'workout', 'eserciz', 'fisioterap', 'chinesiolog'],
  mindfulness: [
    'mindfulness',
    'stress',
    'sonno',
    'ansia',
    'burnout',
    'insonnia',
    'psicolog',
    'mental',
    'coach',
  ],
  inspiration: ['inspiration', 'carriera', 'finanz', 'legale', 'organizz'],
  coordination: ['coordin', 'team', 'orchestr'],
}

const AGENT_SEMANTIC_SIGNALS: Record<string, string[]> = {
  'analista-contesto': [
    'non so da dove partire',
    'quadro confuso',
    'troppe aree',
    'troppe cose',
    'priorità',
    'fare ordine',
  ],
  psicologo: ['ansia', 'stress', 'burnout', 'trauma', 'relazione', 'pensieri', 'psicolog'],
  'mental-coach': ['blocco mentale', 'performance', 'pre gara', 'concentrazione', 'mental'],
  'sleep-coach': ['sonno', 'insonnia', 'russamento', 'apnee', 'osas', 'dormo male'],
  'relationship-coach': ['separazione', 'relazione', 'coppia', 'partner', 'conflitto'],
  'executive-coach': ['leadership', 'manager', 'team', 'ruolo', 'decisioni', 'focus'],
  'consulente-legale': [
    'legal',
    'problemi legali',
    'aspetti legali',
    'questione legale',
    'separazione',
    'causa',
    'contratto',
    'avvocato',
    'tutela',
    'affido',
    'accordi',
  ],
  'financial-planner': [
    'debiti',
    'spese',
    'bilancio',
    'risparmi',
    'soldi',
    'finanza',
    'mutuo',
    'rate',
    'bollette',
    'prestiti',
  ],
  commercialista: ['tasse', 'fisco', 'dichiarazione', 'partita iva', 'tributi'],
  'life-organizer': [
    'organizzarmi',
    'gestire tutto',
    'routine',
    'organizzazione',
    'agenda',
    'priorità',
    'fare ordine',
  ],
  dietista: ['dieta', 'alimentare', 'mangiare', 'peso', 'dimagrire', 'allergie alimentari'],
  chef: ['ricette', 'cucinare', 'pasti', 'menu', 'spesa'],
  gastroenterologo: [
    'gastrite',
    'reflusso',
    'digestivi',
    'gonfiore',
    'intestino',
    'nausea',
    'dolore addominale',
    'digestione',
    'crampi',
  ],
  cardiologo: [
    'cuore',
    'petto',
    'pressione',
    'palpitazioni',
    'fiato corto',
    'toracico',
    'tachicardia',
    'giramenti',
  ],
  mmg: ['sintomi', 'pressione', 'giramenti', 'farmaci', 'medico'],
  fisioterapista: [
    'dolore',
    'riabilitazione',
    'recupero',
    'mobilità',
    'ginocchio',
    'schiena',
    'spalla',
    'caviglia',
  ],
  fisiatra: ['dolore', 'funzionale', 'riabilitazione', 'limitazioni', 'diagnosi', 'cronico'],
  chinesologo: ['movimento', 'postura', 'esercizi', 'dolore', 'rieducazione', 'schema motorio'],
  'medico-dello-sport': ['sport', 'performance', 'idoneità', 'infortunio', 'corsa', 'correre'],
  'persona-trainer': ['allenamento', 'scheda', 'workout', 'forza', 'cardio'],
  dermatologo: ['pelle', 'sfoghi', 'eczema', 'acne', 'dermat', 'rash', 'prurito', 'orticaria'],
  endocrinologo: ['ormoni', 'tiroide', 'insulina', 'metabolismo'],
}

const SAME_DOMAIN_HANDOFF_GENERALISTS = new Set([
  'orchestratore',
  'analista-contesto',
  'life-organizer',
  'relationship-coach',
  'career-coach',
  'executive-coach',
  'commercialista',
  'chef',
  'mmg',
  'gastroenterologo',
  'dermatologo',
])

const GENERIC_TRIGGER_PATTERN =
  /(fuori competenza|specialista|specialisti|co-gestione|invio|medico|psicologo|valutazione medica|stop e valutazione)/i

const TRIGGER_STOPWORDS = new Set([
  'della',
  'dello',
  'delle',
  'degli',
  'della',
  'delle',
  'della',
  'team',
  'caso',
  'utente',
  'specialista',
  'specialisti',
  'valutazione',
  'invio',
  'fuori',
  'competenza',
  'dominio',
  'quando',
  'diventa',
  'prevalente',
  'posso',
  'prendere',
  'carico',
])

function hasRuntimeContract(agent: AgentProfile): agent is AgentProfile & {
  runtimeCapabilities: RuntimeCapabilityContract
} {
  return Boolean(agent.runtimeCapabilities)
}

export function getAgentRuntimeContract(
  team: AgentProfile[],
  agentId?: string | null,
): RuntimeCapabilityContract | undefined {
  if (!agentId) return undefined
  return team.find((agent) => agent.id === agentId)?.runtimeCapabilities
}

export function agentSupportsDomain(agent: AgentProfile | undefined, domain: Domain): boolean {
  if (!agent) return false
  return agent.domainTags.includes(domain) || domain === 'general'
}

export function shouldTriggerPermanentHandoff(params: {
  team: AgentProfile[]
  ownerAgentId: string
  consultTargetAgentId?: string
  detectedDomain: Domain
  message: string
}): boolean {
  return findPermanentHandoffTriggerReason(params) !== null
}

function getSupportingAgentsForDomain(team: AgentProfile[], domain: Domain): AgentProfile[] {
  return team.filter((agent) => agentSupportsDomain(agent, domain) && agent.id !== 'orchestratore')
}

function normalizeText(value: string): string {
  return value.toLowerCase()
}

function tokenizeMeaningfulTerms(value: string): string[] {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !TRIGGER_STOPWORDS.has(token))
}

function hasTextSignal(text: string, signals: string[]): boolean {
  const tokens = normalizeText(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  return signals.some((signal) => {
    if (signal.length === 0) return false
    if (signal.includes(' ')) return text.includes(signal)
    return tokens.some((token) => token.startsWith(signal))
  })
}

function countTextSignals(text: string, signals: string[]): number {
  const normalized = normalizeText(text)
  return signals.reduce((acc, signal) => {
    if (signal.length === 0) return acc
    if (signal.includes(' ')) return normalized.includes(signal) ? acc + 1 : acc
    return normalized.includes(signal) ? acc + 1 : acc
  }, 0)
}

function getDetectedDomainSignals(
  detectedDomain: Domain,
  supportingAgents: AgentProfile[],
): string[] {
  const signals = [
    detectedDomain,
    ...DOMAIN_TRIGGER_KEYWORDS[detectedDomain],
    ...supportingAgents.flatMap((agent) => [
      normalizeText(agent.id),
      normalizeText(agent.displayName),
    ]),
  ]

  return [...new Set(signals.filter((signal) => signal.length >= 4))]
}

function getSharedMeaningfulTokens(trigger: string, message: string): string[] {
  const messageTokens = tokenizeMeaningfulTerms(message)
  const overlaps = (left: string, right: string): boolean => {
    if (left === right) return true
    const leftPrefix = left.slice(0, Math.min(left.length, 5))
    const rightPrefix = right.slice(0, Math.min(right.length, 5))
    return left.startsWith(rightPrefix) || right.startsWith(leftPrefix)
  }

  return tokenizeMeaningfulTerms(trigger).filter((token) =>
    messageTokens.some((messageToken) => overlaps(token, messageToken)),
  )
}

function scoreTriggerMatch(
  trigger: string,
  detectedDomain: Domain,
  message: string,
  team: AgentProfile[],
): number {
  if (detectedDomain === 'general') return 0
  const lowerMessage = normalizeText(message)
  const lowerTrigger = normalizeText(trigger)
  const supportingAgents = getSupportingAgentsForDomain(team, detectedDomain)
  const domainSignals = getDetectedDomainSignals(detectedDomain, supportingAgents)
  const triggerMentionsDomain = hasTextSignal(trigger, domainSignals)
  const messageMentionsDomain = hasTextSignal(lowerMessage, domainSignals)
  const sharedTokens = getSharedMeaningfulTokens(trigger, message)
  const hasGenericConsultLanguage = GENERIC_TRIGGER_PATTERN.test(trigger)
  const hasStrongFamilyLegalSignal = /\blegal|avvocat|affido|accordi|tutela|causa|giurid/i.test(
    lowerMessage,
  )
  const triggerIsFamilyLegal = /\blegal|avvocat|affido|accordi|tutela|causa|giurid/i.test(
    lowerTrigger,
  )
  const messageIsOnlyRelationalSeparation =
    /\bsepar(?:az|and)/i.test(lowerMessage) && !hasStrongFamilyLegalSignal
  if (triggerIsFamilyLegal && messageIsOnlyRelationalSeparation) return 0

  let score = 0
  if (triggerMentionsDomain) score += 3
  if (messageMentionsDomain) score += 3
  score += Math.min(sharedTokens.length, 3) * 2
  if (hasGenericConsultLanguage && messageMentionsDomain) score += 1
  if (triggerIsFamilyLegal && hasStrongFamilyLegalSignal) score += 4
  if (/dolore torac|fiato corto|dispnea|petto|pressione alta|girament/i.test(lowerMessage)) {
    if (/medic|cardi|mmg|health|clin/i.test(trigger)) score += 4
  }
  return score
}

function findMatchingTrigger(
  triggers: string[],
  detectedDomain: Domain,
  message: string,
  team: AgentProfile[],
): string | null {
  if (detectedDomain === 'general') return null
  const ranked = triggers
    .map((trigger) => ({
      trigger,
      score: scoreTriggerMatch(trigger, detectedDomain, message, team),
    }))
    .filter((entry) => entry.score >= 5)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.trigger ?? null
}

function supportsArtifactDomain(agent: AgentProfile, storageType: ArtifactStorageType): boolean {
  const allowedDomains = ARTIFACT_DOMAIN_MAP[storageType]
  if (!allowedDomains) return true
  const runtime = agent.runtimeCapabilities
  if (runtime) {
    const toolPrefix =
      storageType === 'nutrition'
        ? 'nutrition.'
        : storageType === 'training'
          ? 'training.'
          : storageType === 'mindfulness'
            ? 'mindfulness.'
            : null
    if (
      toolPrefix &&
      runtime.artifacts.some((artifact) => artifact.storageType === storageType) &&
      runtime.allowedTools.some((tool) => tool.startsWith(toolPrefix))
    ) {
      return true
    }
  }
  return agent.domainTags.some((domain) => allowedDomains.includes(domain))
}

function scoreConsultTarget(params: {
  agent: AgentProfile
  ownerAgentId: string
  detectedDomain: Domain
  message: string
  ownerReason: string | null
  targetReason: string | null
}): number {
  const lowerMessage = normalizeText(params.message)
  const lowerAgentName = normalizeText(params.agent.displayName)
  const lowerAgentId = normalizeText(params.agent.id)
  const semanticSignals = AGENT_SEMANTIC_SIGNALS[params.agent.id] ?? []

  let score = 0
  if (params.agent.id === params.ownerAgentId) return -100
  if (agentSupportsDomain(params.agent, params.detectedDomain)) score += 6
  if (params.targetReason) score += 5
  if (params.ownerReason) {
    const lowerOwnerReason = normalizeText(params.ownerReason)
    if (lowerOwnerReason.includes(lowerAgentId) || lowerOwnerReason.includes(lowerAgentName)) {
      score += 8
    }
  }
  if (lowerMessage.includes(lowerAgentId) || lowerMessage.includes(lowerAgentName)) score += 8
  score += Math.min(countTextSignals(lowerMessage, semanticSignals), 3) * 3

  if (params.detectedDomain === 'health') {
    if (
      params.agent.id === 'cardiologo' &&
      /\bdolore\s+toracic|\bdolore\s+al\s+petto|\bfiato\s+corto|\bdispnea|\btachicardia|\bpalpitazioni|\bpressione\s+alta|\bgirament/i.test(
        lowerMessage,
      )
    ) {
      score += 10
    }
    if (
      params.agent.id === 'dermatologo' &&
      /\bsfoghi?\b|\brash\b|\bprurito\b|\beczema\b|\bdermatit|\bacne\b|\bpelle\b/i.test(
        lowerMessage,
      )
    ) {
      score += 10
    }
    if (
      params.agent.id === 'gastroenterologo' &&
      /\bgonfiore\b|\bproblemi?\s+digestiv|\bdigestione\b|\bdolore\s+addominale|\bcrampi?\b|\breflusso\b|\bnausea\b|\bvomito\b/i.test(
        lowerMessage,
      )
    ) {
      score += 10
    }
    if (
      /\bdolore\s+toracic|\bdolore\s+al\s+petto|\bfiato\s+corto|\bdispnea|\bpressione\s+alta|\bgirament/i.test(
        lowerMessage,
      ) &&
      params.agent.domainTags.includes('health')
    ) {
      score += 6
    }
    if (
      params.agent.id === 'fisioterapista' &&
      /\b(dolore|male|infortunio)\b/i.test(lowerMessage) &&
      /\b(ginocchio|schiena|spalla|caviglia|corro|correndo|allenamento|mi alleno)\b/i.test(
        lowerMessage,
      )
    ) {
      score += 9
    }
    if (
      params.agent.id === 'fisiatra' &&
      /\b(dolore persistente|limitazioni|cronico|funzionale)\b/i.test(lowerMessage)
    ) {
      score += 8
    }
    if (
      params.agent.id === 'medico-dello-sport' &&
      /\b(sport|corsa|corro|performance|idoneit)\b/i.test(lowerMessage) &&
      /\b(dolore|infortunio|male)\b/i.test(lowerMessage)
    ) {
      score += 8
    }
    if (
      params.agent.id === 'sleep-coach' &&
      !/\bsonno|insonnia|russamento|apnee|osas\b/i.test(lowerMessage)
    ) {
      score -= 6
    }
  }

  if (params.detectedDomain === 'training') {
    if (
      params.agent.id === 'fisioterapista' &&
      /\b(dolore|male|infortunio)\b/i.test(lowerMessage) &&
      /\b(alleno|allenamento|corro|corsa|ginocchio|schiena|spalla|caviglia)\b/i.test(lowerMessage)
    ) {
      score += 10
    }
    if (
      params.agent.id === 'fisiatra' &&
      /\b(dolore persistente|limitazioni|cronico|recidiva)\b/i.test(lowerMessage)
    ) {
      score += 7
    }
    if (
      params.agent.id === 'medico-dello-sport' &&
      /\b(corro|corsa|sport|gara|performance|idoneit)\b/i.test(lowerMessage) &&
      /\b(dolore|infortunio|male)\b/i.test(lowerMessage)
    ) {
      score += 8
    }
    if (
      params.agent.id === 'persona-trainer' &&
      /\b(scheda|programma|allenamento|workout)\b/i.test(lowerMessage) &&
      !/\b(dolore|male|infortunio)\b/i.test(lowerMessage)
    ) {
      score += 5
    }
  }

  if (params.detectedDomain === 'mindfulness') {
    if (
      params.agent.id === 'psicologo' &&
      /\bansia|burnout|sopraffatt|trauma\b/i.test(lowerMessage)
    )
      score += 5
    if (
      params.agent.id === 'psicologo' &&
      /\b(lavoro|focus|concentrarmi|decisioni)\b/i.test(lowerMessage) &&
      /\b(burnout|ansia|stress)\b/i.test(lowerMessage)
    ) {
      score += 4
    }
    if (params.agent.id === 'sleep-coach' && !/\bsonno|insonnia|dorm/i.test(lowerMessage))
      score -= 5
    if (
      params.agent.id === 'mental-coach' &&
      /\b(performance|prestazione|pre.?gara|focus)\b/i.test(lowerMessage)
    ) {
      score += 5
    }
    if (
      params.agent.id === 'mental-coach' &&
      /\b(burnout|ansia|stress)\b/i.test(lowerMessage) &&
      !/\b(performance|prestazione|pre.?gara|focus)\b/i.test(lowerMessage)
    ) {
      score -= 3
    }
    if (
      params.agent.id === 'life-organizer' &&
      /\b(organizzarmi|gestire tutto|troppe cose|priorit[àa])\b/i.test(lowerMessage) &&
      /\b(burnout|stress|sopraffatt)\b/i.test(lowerMessage)
    ) {
      score += 4
    }
  }

  if (params.detectedDomain === 'inspiration') {
    const strongLegalFamilySignal = /\blegal|avvocat|affido|accordi|tutela|giurid|familia/i.test(
      lowerMessage,
    )
    const relationalSeparationOnly =
      /\bsepar(?:az|and)/i.test(lowerMessage) && !strongLegalFamilySignal
    if (
      params.agent.id === 'consulente-legale' &&
      /\b(problemi?\s+legali|aspetti?\s+legali|questioni?\s+legali|legale|separaz|causa|contratto|avvocat|accordi|affido|tutela)\b/i.test(
        lowerMessage,
      )
    )
      score += 10
    if (params.agent.id === 'consulente-legale' && strongLegalFamilySignal) score += 6
    if (params.agent.id === 'consulente-legale' && relationalSeparationOnly) score -= 14
    if (
      params.agent.id === 'financial-planner' &&
      /\bdebiti|soldi|spese|tasse|fisco|bilancio|mutuo|rate|bollette|prestiti/i.test(lowerMessage)
    )
      score += 10
    if (
      params.agent.id === 'financial-planner' &&
      /\b(debiti|mutuo|rate|spese|bollette|soldi)\b/i.test(lowerMessage) &&
      /\b(ansia|stress|sopraffatt)\b/i.test(lowerMessage)
    ) {
      score += 4
    }
    if (
      strongLegalFamilySignal &&
      ['career-coach', 'relationship-coach', 'life-organizer'].includes(params.agent.id)
    ) {
      score -= 5
    }
    if (
      params.agent.id === 'relationship-coach' &&
      /\b(separaz|relazione|coppia|partner)\b/i.test(lowerMessage) &&
      !strongLegalFamilySignal
    ) {
      score += 6
    }
    if (
      params.agent.id === 'career-coach' &&
      /\blavoro|carriera|colloquio|ruolo|burnout\b/i.test(lowerMessage)
    )
      score += 6
    if (
      params.agent.id === 'executive-coach' &&
      /\b(lavoro|team|manager|leadership|decisioni|focus)\b/i.test(lowerMessage) &&
      /\b(stress|burnout|blocco)\b/i.test(lowerMessage)
    ) {
      score += 8
    }
    if (
      params.agent.id === 'commercialista' &&
      /\b(tasse|fisco|partita iva|iva|tributi|contabil)\b/i.test(lowerMessage)
    ) {
      score += 9
    }
    if (
      params.agent.id === 'life-organizer' &&
      /\bgestire tutto|organizzarmi|troppe cose|incastrare tutto|problemi pratici|priorit[àa]|fare ordine\b/i.test(
        lowerMessage,
      )
    )
      score += 6
  }

  if (params.detectedDomain === 'coordination') {
    if (
      params.agent.id === 'analista-contesto' &&
      /\b(non so da dove partire|quadro confuso|troppe aree|fare ordine|priorit[àa])\b/i.test(
        lowerMessage,
      )
    ) {
      score += 10
    }
    if (
      params.agent.id === 'life-organizer' &&
      /\b(organizzarmi|gestire tutto|routine|agenda|incastrare tutto|priorit[àa])\b/i.test(
        lowerMessage,
      )
    ) {
      score += 10
    }
  }

  return score
}

function allowsSameDomainHandoff(
  owner: AgentProfile | undefined,
  consultTarget: AgentProfile,
): boolean {
  if (!owner) return false
  return (
    owner.domainTags.includes('coordination') ||
    SAME_DOMAIN_HANDOFF_GENERALISTS.has(owner.id) ||
    owner.domainTags.length > consultTarget.domainTags.length
  )
}

export function findCapabilityConsultTarget(params: {
  team: AgentProfile[]
  ownerAgentId: string
  detectedDomain: Domain
  message: string
}): { agentId: string; reason: string } | null {
  const owner = params.team.find((agent) => agent.id === params.ownerAgentId)
  if (!owner || params.detectedDomain === 'general') {
    return null
  }

  const consultTargets = getSupportingAgentsForDomain(params.team, params.detectedDomain).filter(
    (agent) => agent.id !== params.ownerAgentId,
  )
  if (consultTargets.length === 0) return null

  const ownerContract = getAgentRuntimeContract(params.team, params.ownerAgentId)
  const ownerReason = findMatchingTrigger(
    ownerContract?.consultTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const targetMatches = consultTargets
    .map((agent) => {
      const targetContract = getAgentRuntimeContract(params.team, agent.id)
      const reason = findMatchingTrigger(
        targetContract?.consultTriggers ?? [],
        params.detectedDomain,
        params.message,
        params.team,
      )
      return { agent, reason }
    })
    .filter((match) => Boolean(match.reason))
  const contractsConfigured =
    (ownerContract?.consultTriggers.length ?? 0) > 0 ||
    consultTargets.some(
      (agent) => (getAgentRuntimeContract(params.team, agent.id)?.consultTriggers.length ?? 0) > 0,
    )

  const ownerDirectedTarget =
    ownerReason == null
      ? null
      : consultTargets.find((agent) => {
          const lowerReason = normalizeText(ownerReason)
          return (
            lowerReason.includes(normalizeText(agent.id)) ||
            lowerReason.includes(normalizeText(agent.displayName))
          )
        })
  const rankedTargets = consultTargets
    .map((agent) => {
      const targetReason =
        targetMatches.find((match) => match.agent.id === agent.id)?.reason ?? null
      return {
        agent,
        reason: targetReason,
        score: scoreConsultTarget({
          agent,
          ownerAgentId: params.ownerAgentId,
          detectedDomain: params.detectedDomain,
          message: params.message,
          ownerReason,
          targetReason,
        }),
      }
    })
    .sort((a, b) => b.score - a.score)

  if (
    contractsConfigured &&
    !ownerReason &&
    targetMatches.length === 0 &&
    (rankedTargets[0]?.score ?? 0) <
      (params.detectedDomain === 'health' || params.detectedDomain === 'inspiration' ? 8 : 9)
  ) {
    return null
  }

  const selectedTarget = ownerDirectedTarget ?? rankedTargets[0]?.agent ?? consultTargets[0]
  const selectedReason =
    targetMatches.find((match) => match.agent.id === selectedTarget.id)?.reason ??
    ownerReason ??
    `semantic_consult:${params.detectedDomain}:${selectedTarget.id}`

  return {
    agentId: selectedTarget.id,
    reason: selectedReason,
  }
}

export function findPermanentHandoffTriggerReason(params: {
  team: AgentProfile[]
  ownerAgentId: string
  consultTargetAgentId?: string
  detectedDomain: Domain
  message: string
}): string | null {
  const owner = params.team.find((agent) => agent.id === params.ownerAgentId)
  const consultTarget = params.team.find((agent) => agent.id === params.consultTargetAgentId)
  if (!consultTarget || params.detectedDomain === 'general') return null
  const domainShift =
    !agentSupportsDomain(owner, params.detectedDomain) &&
    agentSupportsDomain(consultTarget, params.detectedDomain)
  const sameDomainSpecializationShift =
    agentSupportsDomain(owner, params.detectedDomain) &&
    agentSupportsDomain(consultTarget, params.detectedDomain) &&
    allowsSameDomainHandoff(owner, consultTarget)
  if (!domainShift && !sameDomainSpecializationShift) return null

  const ownerContract = getAgentRuntimeContract(params.team, params.ownerAgentId)
  const targetContract = getAgentRuntimeContract(params.team, consultTarget.id)
  const ownerReason = findMatchingTrigger(
    ownerContract?.handoffTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const targetReason = findMatchingTrigger(
    targetContract?.handoffTriggers ?? [],
    params.detectedDomain,
    params.message,
    params.team,
  )
  const contractsConfigured =
    (ownerContract?.handoffTriggers.length ?? 0) > 0 ||
    (targetContract?.handoffTriggers.length ?? 0) > 0
  const targetSemanticHits = countTextSignals(
    normalizeText(params.message),
    AGENT_SEMANTIC_SIGNALS[consultTarget.id] ?? [],
  )

  if (
    contractsConfigured &&
    !ownerReason &&
    !targetReason &&
    !(sameDomainSpecializationShift && targetSemanticHits >= 2)
  )
    return null

  const lowerMessage = normalizeText(params.message)
  if (
    consultTarget.id === 'sleep-coach' &&
    /\bansia|burnout|sopraffatt/i.test(lowerMessage) &&
    !/\bsonno|insonnia|russamento|apnee|osas\b/i.test(lowerMessage)
  ) {
    return ownerReason && /psicolog/i.test(ownerReason) ? ownerReason : null
  }

  return (
    targetReason ??
    ownerReason ??
    (sameDomainSpecializationShift && targetSemanticHits >= 2
      ? `capability_handoff:${params.detectedDomain}:${consultTarget.id}`
      : null)
  )
}

export function agentSupportsArtifactStorageType(
  agent: AgentProfile | undefined,
  storageType: ArtifactStorageType,
): boolean {
  if (!agent) return false
  if (!supportsArtifactDomain(agent, storageType)) return false
  if (!hasRuntimeContract(agent)) return storageType === 'other'
  return agent.runtimeCapabilities.artifacts.some(
    (artifact) => artifact.storageType === storageType,
  )
}
