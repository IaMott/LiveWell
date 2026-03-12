import { AgentProfile, ActiveSpecialist, DecisionTraceEvent, Domain } from '../types'
import { selectAgentsForRequest } from '../consensus/consensusEngine'
import {
  buildAgentsSelectedTraceEvent,
  buildSpecialistModeResolvedTraceEvent,
} from './decisionTrace'

/** Phrases that signal the user wants to speak with a specific specialist */
const REQUEST_VERBS = [
  'parlami con',
  'parla con',
  'voglio parlare con',
  'voglio parlare al',
  'voglio il',
  'voglio la',
  'passami il',
  'passami la',
  'dammi il',
  'fammi parlare con',
  'connettimi con',
  'vorrei parlare con',
  'vorrei il',
  'speak to',
  'talk to',
  'chiedi al',
]

/** Maps keyword → agent id for specialist detection */
const SPECIALIST_KEYWORDS: Record<string, string> = {
  dietista: 'dietista',
  dietitian: 'dietista',
  nutrizionista: 'dietista',
  chef: 'chef',
  cuoco: 'chef',
  endocrinologo: 'endocrinologo',
  endocrinologa: 'endocrinologo',
  'personal trainer': 'persona-trainer',
  'personal-trainer': 'persona-trainer',
  trainer: 'persona-trainer',
  allenatore: 'persona-trainer',
  chinesologo: 'chinesologo',
  chinesiologia: 'chinesologo',
  'medico dello sport': 'medico-dello-sport',
  'medico sport': 'medico-dello-sport',
  fisioterapista: 'fisioterapista',
  fisiatra: 'fisiatra',
  'sleep coach': 'sleep-coach',
  'coach del sonno': 'sleep-coach',
  mmg: 'mmg',
  'medico di base': 'mmg',
  'medico curante': 'mmg',
  'medico generico': 'mmg',
  gastroenterologo: 'gastroenterologo',
  gastro: 'gastroenterologo',
  cardiologo: 'cardiologo',
  cardiologa: 'cardiologo',
  dermatologo: 'dermatologo',
  dermatologa: 'dermatologo',
  psicologo: 'psicologo',
  psicologa: 'psicologo',
  'mental coach': 'mental-coach',
  'mental-coach': 'mental-coach',
  'coach relazionale': 'relationship-coach',
  'relationship coach': 'relationship-coach',
  'analista contesto': 'analista-contesto',
  'financial planner': 'financial-planner',
  'pianificatore finanziario': 'financial-planner',
  commercialista: 'commercialista',
  'career coach': 'career-coach',
  'coach carriera': 'career-coach',
  'executive coach': 'executive-coach',
  'organizzatore di vita': 'life-organizer',
  'life organizer': 'life-organizer',
  'consulente legale': 'consulente-legale',
  avvocato: 'consulente-legale',
}

const SPECIALIST_EXIT_PATTERNS = [
  /esci\s+dalla\s+modalit[aà]\s+specialista/i,
  /torna\s+al\s+team/i,
  /chiudi\s+specialista/i,
  /basta\s+specialista/i,
]

function detectSpecialistRequest(message: string, team: AgentProfile[]): string | null {
  const lower = message.toLowerCase()

  for (const [kw, agentId] of Object.entries(SPECIALIST_KEYWORDS)) {
    if (lower.includes(kw) && team.some((agent) => agent.id === agentId)) {
      return agentId
    }
  }

  const hasRequestVerb = REQUEST_VERBS.some((verb) => lower.includes(verb))
  if (!hasRequestVerb) return null

  for (const agent of team) {
    if (lower.includes(agent.displayName.toLowerCase())) return agent.id
  }

  return null
}

function shouldExitSpecialistMode(message: string): boolean {
  return SPECIALIST_EXIT_PATTERNS.some((pattern) => pattern.test(message))
}

function pickSpecialistEffectiveDomain(
  activeSpecialist: ActiveSpecialist | undefined,
  detectedDomain: Domain,
): Domain {
  if (!activeSpecialist) return detectedDomain
  const domains = activeSpecialist.domains ?? [activeSpecialist.domain]
  if (domains.includes(detectedDomain)) return detectedDomain
  const preferred = domains.find((domain) => domain !== 'general' && domain !== 'coordination')
  return preferred ?? activeSpecialist.domain
}

type ResolveRoutingParams = {
  team: AgentProfile[]
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  activeSpecialistId?: string
}

type RoutingResolution = {
  activeSpecialist?: ActiveSpecialist
  domainHint: Domain
  selectedAgents: AgentProfile[]
  decisionTrace: DecisionTraceEvent[]
}

export function resolveRoutingContext(params: ResolveRoutingParams): RoutingResolution {
  const { team, message, detectedDomain, allDomains, activeSpecialistId } = params
  const decisionTrace: DecisionTraceEvent[] = []

  let lockedAgentId = activeSpecialistId ?? null
  const requestedSpecialistId = detectSpecialistRequest(message, team)
  const exitSpecialistMode = Boolean(lockedAgentId && shouldExitSpecialistMode(message))

  if (exitSpecialistMode) {
    lockedAgentId = null
  }

  if (!lockedAgentId) {
    if (requestedSpecialistId) lockedAgentId = requestedSpecialistId
  }

  let activeSpecialist: ActiveSpecialist | undefined
  if (lockedAgentId) {
    const agent = team.find((candidate) => candidate.id === lockedAgentId)
    if (agent) {
      activeSpecialist = {
        id: agent.id,
        displayName: agent.displayName,
        domain: (agent.domainTags[0] ?? detectedDomain) as Domain,
        domains: agent.domainTags,
      }
    }
  }

  const domainHint = pickSpecialistEffectiveDomain(activeSpecialist, detectedDomain)

  const selectedAgents = activeSpecialist
    ? (() => {
        const base = selectAgentsForRequest(team, domainHint, 6, allDomains, message).filter(
          (agent) => agent.id !== 'orchestratore',
        )
        const ordered = [
          team.find((agent) => agent.id === activeSpecialist?.id),
          ...base.filter((agent) => agent.id !== activeSpecialist?.id),
        ].filter((agent): agent is AgentProfile => Boolean(agent))
        return ordered.slice(0, 3)
      })()
    : selectAgentsForRequest(team, domainHint, 4, allDomains, message)

  const specialistReason = exitSpecialistMode
    ? 'explicit_exit_request'
    : requestedSpecialistId
      ? 'explicit_specialist_request'
      : activeSpecialistId && activeSpecialist
        ? 'keep_previous_specialist'
        : 'no_specialist_lock'

  decisionTrace.push(
    buildSpecialistModeResolvedTraceEvent({
      step: 2,
      requestedSpecialistId,
      previousActiveSpecialistId: activeSpecialistId ?? null,
      activeSpecialist,
      exitSpecialistMode,
      reason: specialistReason,
    }),
  )

  decisionTrace.push(
    buildAgentsSelectedTraceEvent({
      step: 3,
      domainHint,
      selectedAgentIds: selectedAgents.map((agent) => agent.id),
      collaborationCap: activeSpecialist ? 3 : 4,
      reason: activeSpecialist ? 'specialist_first_collaboration' : 'domain_based_selection',
    }),
  )

  return {
    activeSpecialist,
    domainHint,
    selectedAgents,
    decisionTrace,
  }
}
