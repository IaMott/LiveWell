import type { AgentProfile, Domain } from '../types'
import {
  findCapabilityConsultTarget,
  findPermanentHandoffTriggerReason,
  shouldTriggerPermanentHandoff,
} from '../capabilities/registry'
import { selectAgentsForRequest } from '../orchestrator/agentSelection'
import { CaseProtocolEvent, CaseState } from './state'

const MAX_CONSULT_LOOPS = 3
const MAX_TAKEOVER_TURNS = 2
const MAX_HANDOFFS = 2

const REQUEST_VERBS = [
  'parlami con',
  'parla con',
  'voglio parlare con',
  'voglio parlare ancora con',
  'voglio parlare al',
  'voglio il',
  'voglio la',
  'passami il',
  'passami la',
  'fammi parlare con',
  'vorrei parlare con',
  'continuiamo con',
  'restiamo con',
  'approfondiamo con',
  'seguimi tu',
  'mi segua lui',
  'mi segua lei',
  'speak to',
  'talk to',
]

const RETURN_PATTERNS = [
  /torna\s+al\s+team/i,
  /torna\s+all'?orchestratore/i,
  /torna\s+allo?\s+specialista\s+iniziale/i,
  /restituisci\s+il\s+testimone/i,
  /torna\s+a\s+chi\s+seguiva\s+il\s+caso/i,
]

const TAKEOVER_CONTINUITY_PATTERNS = [
  /\bcontinuiamo\s+con\b/i,
  /\bcontinua(?:re)?\s+con\b/i,
  /\bproseguiamo\s+con\b/i,
  /\bprosegui(?:amo)?\s+con\b/i,
  /\brestiamo\s+su\s+questo\s+tema\b/i,
  /\brestiamo\s+su\s+questa\s+parte\b/i,
  /\brestiamo\s+su\s+questo\s+percorso\b/i,
  /\bapprofondiamo\s+questa\s+parte\b/i,
  /\bapprofondiamo\b/i,
  /\bcontinuiamo\s+su\s+questo\b/i,
  /\bandiamo\s+avanti\s+su\s+questa\s+parte\b/i,
  /\bparliamo\s+ancora\s+di\s+questo\s+con\b/i,
  /\bvorrei\s+proseguire\s+con\b/i,
  /\bvorrei\s+che\s+fosse\s+lui\s+a\s+seguirmi\b/i,
  /\bvorrei\s+che\s+fosse\s+lei\s+a\s+seguirmi\b/i,
  /\bcontinuiamo\s+con\s+lui\b/i,
  /\bcontinuiamo\s+con\s+lei\b/i,
  /\bproseguiamo\s+con\s+lui\b/i,
  /\bproseguiamo\s+con\s+lei\b/i,
]

const CONTEXT_CONTINUATION_PATTERNS = [
  /\bcontinuiamo\b/i,
  /\bcontinua\b/i,
  /\bproseguiamo\b/i,
  /\bprosegui\b/i,
  /\briprendiamo\b/i,
  /\briprendi\b/i,
  /\btorniamo\b/i,
  /\bda dove eravamo rimasti\b/i,
  /\bcontinua pure\b/i,
  /\brestiamo\b/i,
  /\bandiamo avanti\b/i,
]

const HANDOFF_CONTINUITY_PATTERNS = [
  /\bvorrei\s+che\s+mi\s+seguisse\b/i,
  /\bvorrei\s+che\s+fosse\s+lui\s+a\s+seguirmi(?:\s+da\s+ora)?\b/i,
  /\bvorrei\s+che\s+fosse\s+lei\s+a\s+seguirmi(?:\s+da\s+ora)?\b/i,
  /\bvorrei\s+proseguire\s+con\b/i,
  /\bvorrei\s+continuare\s+con\s+lui\b.*\b(stabile|stabilmente|riferimento\s+principale)\b/i,
  /\bvorrei\s+continuare\s+con\s+lei\b.*\b(stabile|stabilmente|riferimento\s+principale)\b/i,
  /\bmi\s+segua\s+lui\b/i,
  /\bmi\s+segua\s+lei\b/i,
  /\brestiamo\s+su\s+questo\s+percorso\b/i,
  /\bandiamo\s+avanti\s+con\s+questo\s+percorso\b/i,
  /\bcontinuiamo\s+con\s+il\s+recupero\b/i,
  /\bcontinuiamo\s+con\s+la\s+terapia\b/i,
]

type AdvanceCaseStateParams = {
  current: CaseState | null
  conversationId: string
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  team: AgentProfile[]
}

export type AdvanceCaseStateResult = {
  caseState: CaseState
  events: CaseProtocolEvent[]
}

function normalizeAgentName(value: string): string {
  return value.toLowerCase().replace(/[-_]/g, ' ').trim()
}

export function detectRequestedAgentId(message: string, team: AgentProfile[]): string | null {
  const lower = message.toLowerCase()
  const hasVerb = REQUEST_VERBS.some((verb) => lower.includes(verb))

  for (const agent of team) {
    const byId = normalizeAgentName(agent.id)
    const byName = normalizeAgentName(agent.displayName)
    if (lower.includes(byId) || lower.includes(byName)) {
      if (hasVerb || lower.includes('parlare con') || lower.includes('passami')) return agent.id
    }
  }

  return null
}

function shouldReturnToOwner(message: string, ownerAgentId: string): boolean {
  const lower = message.toLowerCase()
  return (
    RETURN_PATTERNS.some((pattern) => pattern.test(message)) ||
    lower.includes(normalizeAgentName(ownerAgentId))
  )
}

function isNaturalTakeoverContinuation(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return TAKEOVER_CONTINUITY_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function isContextContinuationMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return (
    CONTEXT_CONTINUATION_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    (!NEW_TOPIC_PATTERN.test(trimmed) && trimmed.split(/\s+/).length <= 6)
  )
}

function isMeaningfulHandoffContinuation(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (/^(ok|okay|va bene|perfetto|grazie|thanks|thank you)[!.,\s]*$/i.test(trimmed)) return false
  return trimmed.split(/\s+/).length > 3 || HANDOFF_CONTINUITY_PATTERNS.some((p) => p.test(trimmed))
}

const NEW_TOPIC_PATTERN =
  /\b(cambiamo argomento|passiamo a|ora invece|un'altra cosa|altro tema|nuovo problema|parliamo di altro)\b/i

function hasConsultFocusSignal(agentId: string | undefined, message: string): boolean {
  if (!agentId) return false
  const lower = message.toLowerCase()

  switch (agentId) {
    case 'consulente-legale':
      return /\b(legale|accordi|affido|tutela|avvocat|separaz|causa|contratto)\b/i.test(lower)
    case 'financial-planner':
      return /\b(debiti|mutuo|rate|spese|bollette|soldi|bilancio|prestiti)\b/i.test(lower)
    case 'gastroenterologo':
      return /\b(reflusso|gastrite|gonfiore|digestiv|nausea|rutti|pasti)\b/i.test(lower)
    case 'sleep-coach':
      return /\b(sonno|insonnia|risvegli|dormo male|caff[eè])\b/i.test(lower)
    case 'psicologo':
      return /\b(ansia|stress|burnout|focus|concentrarmi|male emotivamente)\b/i.test(lower)
    default:
      return false
  }
}

function scoreImplicitOwnerCandidate(
  agent: AgentProfile,
  detectedDomain: Domain,
  message: string,
): number {
  const lower = message.toLowerCase()
  if (!agentSupportsDetectedDomain(agent, detectedDomain)) return -1

  const matches = (patterns: RegExp[]): number =>
    patterns.reduce((acc, pattern) => (pattern.test(lower) ? acc + 1 : acc), 0)

  let score = 0
  switch (agent.id) {
    case 'dietista':
      score +=
        matches([
          /\bdieta\b/i,
          /\bpiano alimentare\b/i,
          /\bpiano nutrizionale\b/i,
          /\bdimagr/i,
          /\bmangiare meglio\b/i,
          /\balimentazione\b/i,
          /\ballergie?\s+alimentari\b/i,
          /\bnon so cosa mangiare\b/i,
          /\bgastrite\b/i,
          /\breflusso\b/i,
        ]) * 3
      if (
        /\b(mangiare meglio|piano alimentare|piano nutrizionale|dimagrire|perdere peso|alimentazione)\b/i.test(
          lower,
        )
      ) {
        score += 3
      }
      break
    case 'chef':
      score += matches([/\bricett/i, /\bcucin/i, /\bmenu\b/i, /\bspesa\b/i]) * 3
      break
    case 'persona-trainer':
      score +=
        matches([
          /\bscheda\b/i,
          /\bricominciare\b/i,
          /\ballenarmi\b/i,
          /\ballenarmi meglio\b/i,
          /\briprendere ad allenarmi\b/i,
        ]) * 3
      break
    case 'fisioterapista':
      score +=
        matches([
          /\bdolore\b/i,
          /\brecupero\b/i,
          /\briabilit/i,
          /\beserciz/i,
          /\bginocchio\b/i,
          /\bschiena\b/i,
          /\bspalla\b/i,
          /\bcaviglia\b/i,
          /\bcollo\b/i,
          /\bcervicale\b/i,
          /\btorcicollo\b/i,
          /\bcontrattura\b/i,
          /\bstrappo\b/i,
          /\bcorro\b/i,
        ]) * 3
      if (/\b(dolore|male)\b/i.test(lower) && /\b(alleno|allenamento|corro|corsa)\b/i.test(lower)) {
        score += 4
      }
      if (
        /\b(male|dolore|fa male)\b/i.test(lower) &&
        /\b(collo|cervicale|schiena|spalla|ginocchio|caviglia|polso|gomito|anca)\b/i.test(lower)
      ) {
        score += 4
      }
      break
    case 'fisiatra':
      score +=
        matches([
          /\bdolore\b/i,
          /\blimitazioni\b/i,
          /\bfunzional/i,
          /\bcronich/i,
          /\briabilit/i,
          /\bcollo\b/i,
          /\bcervicale\b/i,
          /\bnervo\b/i,
        ]) * 3
      break
    case 'chinesologo':
      score +=
        matches([
          /\bpostura\b/i,
          /\bmovimento\b/i,
          /\brieduc/i,
          /\bschema motorio\b/i,
          /\bmobilit/i,
        ]) * 3
      break
    case 'medico-dello-sport':
      score +=
        matches([
          /\bsport\b/i,
          /\bcorro\b/i,
          /\bcorsa\b/i,
          /\bperformance\b/i,
          /\binfortun/i,
          /\bidoneit/i,
        ]) * 3
      break
    case 'cardiologo':
      score +=
        matches([
          /\bdolore\s+toracic/i,
          /\bdolore\s+al\s+petto/i,
          /\bfiato\s+corto\b/i,
          /\bdispnea\b/i,
          /\btachicardia\b/i,
          /\bpressione\s+alta\b/i,
        ]) * 4
      break
    case 'dermatologo':
      score +=
        matches([
          /\bsfoghi?\b/i,
          /\brash\b/i,
          /\bprurito\b/i,
          /\beczema\b/i,
          /\bpelle\b/i,
          /\bcutane/i,
          /\bpersistenti?\b/i,
        ]) * 4
      break
    case 'gastroenterologo':
      score +=
        matches([
          /\bgonfiore\b/i,
          /\bproblemi?\s+digestiv/i,
          /\bdigestione\b/i,
          /\bdolore\s+addominale\b/i,
          /\bgastrite\b/i,
          /\breflusso\b/i,
          /\bnausea\b/i,
          /\bvomito\b/i,
        ]) * 4
      break
    case 'endocrinologo':
      score +=
        matches([
          /\bormoni\b/i,
          /\btiroide\b/i,
          /\binsulina\b/i,
          /\bmetabolismo\b/i,
          /\bglicemia\b/i,
        ]) * 4
      break
    case 'mmg':
      score +=
        matches([/\bfarmaci\b/i, /\bpressione\b/i, /\bsintomi\b/i, /\besami\b/i, /\bmedico\b/i]) * 2
      break
    case 'psicologo':
      score +=
        matches([
          /\bansia\b/i,
          /\bstress\b/i,
          /\bburnout\b/i,
          /\bconcentrarmi\b/i,
          /\bmale emotivamente\b/i,
          /\bdormo male\b/i,
        ]) * 3
      if (/\b(burnout|stress|ansia|focus|concentrarmi)\b/i.test(lower)) score += 4
      if (/\b(lavoro|team|ruolo)\b/i.test(lower) && /\b(burnout|stress|focus)\b/i.test(lower)) {
        score += 2
      }
      break
    case 'sleep-coach':
      score +=
        matches([
          /\bdormo\b/i,
          /\bsonno\b/i,
          /\binsonnia\b/i,
          /\brussamento\b/i,
          /\brisvegli\b/i,
          /\bcaff[eè]\b/i,
        ]) * 3
      if (
        /\b(torniamo al sonno|riprendiamo dal sonno|dormo\s+\d+\s+ore|caff[eè].{0,20}tardi|risvegli)\b/i.test(
          lower,
        )
      ) {
        score += 4
      }
      break
    case 'mental-coach':
      score +=
        matches([
          /\bblocco mentale\b/i,
          /\bpre-gara\b/i,
          /\bperformance\b/i,
          /\bfocus\b/i,
          /\bprestazione\b/i,
        ]) * 3
      break
    case 'relationship-coach':
      score +=
        matches([
          /\bsepar(?:az|and)/i,
          /\brelazione\b/i,
          /\bcoppia\b/i,
          /\bpartner\b/i,
          /\bmale emotivamente\b/i,
        ]) * 3
      if (
        /\bsepar(?:az|and)/i.test(lower) &&
        !/\blegal|accordi|affido|tutela|avvocat/i.test(lower)
      ) {
        score += 4
      }
      if (/\b(figli|soldi|problemi pratici)\b/i.test(lower) && /\bsepar(?:az|and)/i.test(lower)) {
        score -= 2
      }
      if (
        /\b(sonno|insonnia|risvegli|dormo\s+\d+\s+ore|caff[eè])\b/i.test(lower) &&
        !/\b(relazione|coppia|partner|conflitto)\b/i.test(lower)
      ) {
        score -= 8
      }
      break
    case 'consulente-legale':
      score +=
        matches([
          /\bseparaz/i,
          /\blegal/i,
          /\baccordi\b/i,
          /\btutela\b/i,
          /\baffido\b/i,
          /\bavvocat/i,
        ]) * 4
      break
    case 'financial-planner':
      score +=
        matches([
          /\bdebiti\b/i,
          /\bmutuo\b/i,
          /\brate\b/i,
          /\bspese\b/i,
          /\bbollette\b/i,
          /\bsoldi\b/i,
        ]) * 4
      if (/\bdebiti\b/i.test(lower) && /\bansia\b/i.test(lower)) score += 4
      break
    case 'career-coach': {
      // "lavoro" in temporal context ("giornata lavorativa", "finito di lavorare") is NOT career
      const isTemporalWork =
        /\b(finito di lavorare|giornata di lavoro|giornata lavorativa|tornato dal lavoro|dopo il lavoro|esco dal lavoro|uscito dal lavoro|pausa lavoro|prima del lavoro|durante il lavoro|andare al lavoro|vado al lavoro|vengo dal lavoro)\b/i.test(
          lower,
        )
      const hasExplicitCareer =
        /\b(carriera|obiettivo professionale|colloquio|promozione|ruolo|cambiare lavoro|cerco lavoro|bloccato nel lavoro)\b/i.test(
          lower,
        )
      if (isTemporalWork && !hasExplicitCareer) {
        // Temporal "lavoro" → strong dampening, skip career-coach
        score -= 10
      } else {
        score +=
          matches([
            /\bcarriera\b/i,
            /\bbloccato nel lavoro\b/i,
            /\bcambiare lavoro\b/i,
            /\bcerco lavoro\b/i,
          ]) * 3
        // Only count bare "lavoro" when in explicit career context
        if (hasExplicitCareer && /\blavoro\b/i.test(lower)) score += 3
      }
      if (/\b(burnout|stress|ansia|focus|concentrarmi)\b/i.test(lower) && !hasExplicitCareer) {
        score -= 6
      }
      if (/\bsepar(?:az|and)|figli|accordi|problemi pratici|soldi\b/i.test(lower)) score -= 10
      break
    }
    case 'executive-coach': {
      const isTemporalWorkExec =
        /\b(finito di lavorare|giornata di lavoro|giornata lavorativa|tornato dal lavoro|dopo il lavoro|esco dal lavoro)\b/i.test(
          lower,
        )
      const hasExplicitExecContext = /\b(leadership|team|manager|ruolo|decisioni)\b/i.test(lower)
      if (isTemporalWorkExec && !hasExplicitExecContext) {
        score -= 10
      } else {
        score +=
          matches([
            /\bleadership\b/i,
            /\bteam\b/i,
            /\bmanager\b/i,
            /\bruolo\b/i,
            /\bdecisioni\b/i,
          ]) * 3
        // Only count bare "lavoro" when in executive context
        if (hasExplicitExecContext && /\blavoro\b/i.test(lower)) score += 3
      }
      if (
        /\b(burnout|stress|focus|concentrarmi)\b/i.test(lower) &&
        /\b(lavoro|team|manager|ruolo)\b/i.test(lower) &&
        hasExplicitExecContext
      ) {
        score += 3
      }
      break
    }
    case 'commercialista':
      score +=
        matches([
          /\btasse\b/i,
          /\bfisco\b/i,
          /\bpartita iva\b/i,
          /\biva\b/i,
          /\bcontabil/i,
          /\btribut/i,
        ]) * 4
      break
    case 'life-organizer':
      score +=
        matches([
          /\bgestire tutto\b/i,
          /\borganizzarmi\b/i,
          /\btroppe cose\b/i,
          /\bincastrare tutto\b/i,
          /\bpriorit[àa]\b/i,
          /\broutine\b/i,
        ]) * 3
      if (
        /\b(gestire tutto|organizzarmi|incastrare tutto|fare ordine|problemi pratici)\b/i.test(
          lower,
        )
      ) {
        score += 3
      }
      if (/\bsepar(?:az|and)/i.test(lower) && /\b(figli|soldi|problemi pratici)\b/i.test(lower)) {
        score += 6
      }
      break
    case 'analista-contesto':
      score +=
        matches([
          /\bnon so da dove partire\b/i,
          /\btroppi fronti\b/i,
          /\bquadro confuso\b/i,
          /\brimettere in ordine\b/i,
          /\bpriorit[àa]\b/i,
          /\bgestire tutto\b/i,
        ]) * 3
      if (
        /\b(non so da dove partire|rimettere in ordine|fare ordine|quadro confuso|troppi fronti)\b/i.test(
          lower,
        )
      ) {
        score += 4
      }
      break
  }

  return score
}

function findImplicitOwnerByMessage(
  team: AgentProfile[],
  detectedDomain: Domain,
  message: string,
): string | null {
  if (detectedDomain === 'general') return null
  const ranked = team
    .filter((agent) => agent.id !== 'orchestratore')
    .map((agent) => ({
      agent,
      score: scoreImplicitOwnerCandidate(agent, detectedDomain, message),
    }))
    .filter((entry) => entry.score >= 6)
    .sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id))

  return ranked[0]?.agent.id ?? null
}

function chooseInitialOwner(params: {
  message: string
  detectedDomain: Domain
  allDomains: Domain[]
  team: AgentProfile[]
}): string {
  const requested = detectRequestedAgentId(params.message, params.team)
  if (requested) return requested

  if (params.detectedDomain === 'general') {
    const neutralOwner =
      params.team.find((agent) => agent.id === 'orchestratore') ??
      params.team.find(
        (agent) =>
          agent.domainTags.includes('coordination') || agent.domainTags.includes('general'),
      )
    return neutralOwner?.id ?? 'orchestratore'
  }

  const implicitOwner = findImplicitOwnerByMessage(
    params.team,
    params.detectedDomain,
    params.message,
  )
  if (implicitOwner) return implicitOwner

  const selected = selectAgentsForRequest(
    params.team.filter((agent) => agent.id !== 'orchestratore'),
    params.detectedDomain,
    1,
    params.allDomains,
    params.message,
  )

  if (selected[0]?.id) return selected[0].id

  const fallback =
    params.team.find((agent) => agent.domainTags.includes(params.detectedDomain)) ??
    params.team.find((agent) => agent.id !== 'orchestratore') ??
    params.team[0]

  return fallback?.id ?? 'orchestratore'
}

export function getCaseRoutingDomain(
  caseState: CaseState | null,
  team: AgentProfile[],
  fallbackDomain: Domain,
): Domain {
  if (!caseState) return fallbackDomain
  const current = team.find((agent) => agent.id === caseState.activeSpeakerAgentId)
  if (fallbackDomain === 'general' && current?.domainTags.includes('coordination')) return 'general'
  if (current?.domainTags.includes(fallbackDomain)) return fallbackDomain
  if (fallbackDomain !== 'general') return fallbackDomain
  const preferred = current?.domainTags.find(
    (domain) => domain !== 'general' && domain !== 'coordination',
  )
  return (preferred ?? current?.domainTags[0] ?? fallbackDomain) as Domain
}

function shouldKeepConsultTargetActive(params: {
  message: string
  consultTargetId?: string
  requestedAgentId: string | null
  currentOwnerAgentId: string
  detectedDomain: Domain
  team: AgentProfile[]
  takeoverTurns: number
}): boolean {
  const { consultTargetId, requestedAgentId, team, message, detectedDomain, takeoverTurns } = params
  if (!consultTargetId || takeoverTurns >= MAX_TAKEOVER_TURNS) return false
  if (requestedAgentId === consultTargetId) return true
  if (requestedAgentId && requestedAgentId !== consultTargetId) return false

  const consultTarget = team.find((agent) => agent.id === consultTargetId)
  if (!consultTarget) return false
  const lower = message.toLowerCase()
  const mentionsConsultTarget =
    lower.includes(normalizeAgentName(consultTarget.id)) ||
    lower.includes(normalizeAgentName(consultTarget.displayName))

  return (
    mentionsConsultTarget ||
    hasConsultFocusSignal(consultTargetId, message) ||
    (isNaturalTakeoverContinuation(message) &&
      agentSupportsDetectedDomain(consultTarget, detectedDomain))
  )
}

function agentSupportsDetectedDomain(
  agent: AgentProfile | undefined,
  detectedDomain: Domain,
): boolean {
  if (!agent) return false
  if (detectedDomain === 'general') return true
  return agent.domainTags.includes(detectedDomain)
}

export function advanceCaseState(params: AdvanceCaseStateParams): AdvanceCaseStateResult {
  const { current, conversationId, message, detectedDomain, allDomains, team } = params
  const events: CaseProtocolEvent[] = []

  if (!current) {
    const requestedAgentId = detectRequestedAgentId(message, team)
    const ownerAgentId =
      requestedAgentId ?? chooseInitialOwner({ message, detectedDomain, allDomains, team })
    const initial: CaseState = {
      conversationId,
      ownerAgentId,
      activeSpeakerAgentId: ownerAgentId,
      protocolState: 'owner_active',
      consultReason: requestedAgentId ? 'explicit_initial_owner' : undefined,
      takeoverTurns: 0,
      loopCount: 0,
      handoffCount: 0,
    }
    events.push({ kind: 'initialized', actorAgentId: ownerAgentId })
    return { caseState: initial, events }
  }

  const requestedAgentId = detectRequestedAgentId(message, team)
  const currentSpeaker = current
    ? team.find((agent) => agent.id === current.activeSpeakerAgentId)
    : undefined
  const preserveCurrentSpeaker =
    current?.protocolState === 'owner_active' &&
    !requestedAgentId &&
    agentSupportsDetectedDomain(currentSpeaker, detectedDomain) &&
    (current.activeSpeakerAgentId !== current.ownerAgentId || isContextContinuationMessage(message))
  const capabilityConsult =
    current.protocolState === 'owner_active' && !requestedAgentId && !preserveCurrentSpeaker
      ? findCapabilityConsultTarget({
          team,
          ownerAgentId: current.ownerAgentId,
          detectedDomain,
          message,
        })
      : null

  if (current.protocolState === 'handoff_pending_user') {
    const pendingHandoffAgentId = current.pendingHandoffAgentId ?? current.activeSpeakerAgentId

    if (shouldReturnToOwner(message, current.returnTargetAgentId ?? current.ownerAgentId)) {
      const next: CaseState = {
        conversationId,
        ownerAgentId: current.returnTargetAgentId ?? current.ownerAgentId,
        activeSpeakerAgentId: current.returnTargetAgentId ?? current.ownerAgentId,
        protocolState: 'owner_active',
        takeoverTurns: 0,
        loopCount: current.loopCount,
        handoffCount: current.handoffCount,
      }
      events.push({
        kind: 'return_baton',
        fromAgentId: pendingHandoffAgentId,
        toAgentId: next.ownerAgentId,
        reason: current.checkpointReason ?? 'handoff_cancelled',
      })
      return { caseState: next, events }
    }

    const next: CaseState = {
      conversationId,
      ownerAgentId: pendingHandoffAgentId,
      activeSpeakerAgentId: pendingHandoffAgentId,
      protocolState: 'owner_active',
      consultReason: 'permanent_handoff',
      takeoverTurns: 0,
      loopCount: current.loopCount,
      handoffCount: current.handoffCount + 1,
    }
    events.push({
      kind: 'handoff_completed',
      fromAgentId: current.ownerAgentId,
      toAgentId: pendingHandoffAgentId,
      reason: current.checkpointReason ?? 'domain_shift_confirmed',
    })
    return { caseState: next, events }
  }

  if (current.protocolState === 'consult_active_takeover') {
    const consultTarget = current.consultTargetAgentId
    const returnTarget = current.returnTargetAgentId ?? current.ownerAgentId
    const naturalHandoffContinuation = HANDOFF_CONTINUITY_PATTERNS.some((pattern) =>
      pattern.test(message),
    )
    const consultTargetProfile = team.find((agent) => agent.id === consultTarget)
    const ownerProfile = team.find((agent) => agent.id === current.ownerAgentId)
    const sameDomainShift =
      consultTargetProfile != null &&
      ownerProfile != null &&
      consultTargetProfile.domainTags.includes(detectedDomain) &&
      ownerProfile.domainTags.includes(detectedDomain)
    const handoffReason =
      consultTarget != null
        ? findPermanentHandoffTriggerReason({
            team,
            ownerAgentId: current.ownerAgentId,
            consultTargetAgentId: consultTarget,
            detectedDomain,
            message,
          })
        : null
    const implicitHandoffReason =
      handoffReason ??
      (consultTarget != null &&
      naturalHandoffContinuation &&
      consultTarget !== current.ownerAgentId &&
      agentSupportsDetectedDomain(
        team.find((agent) => agent.id === consultTarget),
        detectedDomain,
      )
        ? `capability_handoff:${detectedDomain}`
        : null)
    const shouldRequestHandoff =
      consultTarget != null &&
      current.handoffCount < MAX_HANDOFFS &&
      !shouldReturnToOwner(message, current.ownerAgentId) &&
      requestedAgentId !== current.ownerAgentId &&
      isMeaningfulHandoffContinuation(message) &&
      Boolean(implicitHandoffReason) &&
      (sameDomainShift
        ? current.takeoverTurns >= 1 && naturalHandoffContinuation
        : Boolean(handoffReason) ||
          naturalHandoffContinuation ||
          shouldTriggerPermanentHandoff({
            team,
            ownerAgentId: current.ownerAgentId,
            consultTargetAgentId: consultTarget,
            detectedDomain,
            message,
          }))
    const continueTakeover = shouldKeepConsultTargetActive({
      message,
      consultTargetId: consultTarget,
      requestedAgentId,
      currentOwnerAgentId: current.ownerAgentId,
      detectedDomain,
      team,
      takeoverTurns: current.takeoverTurns,
    })

    if (shouldRequestHandoff && consultTarget) {
      const targetId = consultTarget
      const next: CaseState = {
        ...current,
        protocolState: 'handoff_pending_user',
        activeSpeakerAgentId: targetId,
        pendingHandoffAgentId: targetId,
        checkpointReason: implicitHandoffReason ?? 'domain_shift_confirmed_by_runtime',
      }
      events.push({
        kind: 'handoff_requested',
        actorAgentId: current.ownerAgentId,
        toAgentId: targetId,
        reason: implicitHandoffReason ?? 'domain_shift_confirmed_by_runtime',
      })
      return { caseState: next, events }
    }

    if (continueTakeover) {
      const targetId = consultTarget!
      const next: CaseState = {
        ...current,
        activeSpeakerAgentId: targetId,
        takeoverTurns: current.takeoverTurns + 1,
      }
      events.push({
        kind: 'takeover_continued',
        actorAgentId: targetId,
        reason: current.consultReason,
      })
      return { caseState: next, events }
    }

    if (
      shouldReturnToOwner(message, current.ownerAgentId) ||
      (!continueTakeover && !shouldRequestHandoff && requestedAgentId == null) ||
      requestedAgentId === current.ownerAgentId ||
      (requestedAgentId != null && requestedAgentId !== consultTarget) ||
      current.takeoverTurns >= MAX_TAKEOVER_TURNS
    ) {
      const next: CaseState = {
        conversationId,
        ownerAgentId: current.ownerAgentId,
        activeSpeakerAgentId: returnTarget,
        protocolState: 'owner_active',
        takeoverTurns: 0,
        loopCount: current.loopCount,
        handoffCount: current.handoffCount,
      }
      events.push({
        kind: 'return_baton',
        fromAgentId: consultTarget,
        toAgentId: returnTarget,
        reason: current.consultReason,
      })
      return { caseState: next, events }
    }
  }

  // ── Domain shift detection ────────────────────────────────────────────
  // When the owner is active but the detected domain is NOT covered by the
  // current owner's domain tags, auto-switch to the best agent for the new
  // domain. This makes specialist transitions feel natural: user talks about
  // back pain → fisioterapista, then mentions sleep → sleep-coach, without
  // needing to explicitly say "passami lo sleep-coach".
  //
  // MULTI-DOMAIN GUARD: When the message spans 2+ distinct domains (e.g.
  // "ho male al ginocchio, nausea, non dormo, giù di morale") we do NOT
  // shift to a single owner — the orchestrator stays as coordinator and
  // all relevant specialists contribute through the pipeline.
  const significantDomains = allDomains.filter((d) => d !== 'general')
  const isMultiDomainMessage = significantDomains.length >= 2
  if (
    current.protocolState === 'owner_active' &&
    !requestedAgentId &&
    !capabilityConsult &&
    detectedDomain !== 'general' &&
    !isMultiDomainMessage
  ) {
    const currentOwner = team.find((a) => a.id === current.ownerAgentId)
    const currentSpeaker = team.find((a) => a.id === current.activeSpeakerAgentId)
    const currentRoutingAgent =
      currentSpeaker && agentSupportsDetectedDomain(currentSpeaker, detectedDomain)
        ? currentSpeaker
        : currentOwner

    if (currentRoutingAgent && !agentSupportsDetectedDomain(currentRoutingAgent, detectedDomain)) {
      const newOwnerId = chooseInitialOwner({ message, detectedDomain, allDomains, team })
      if (newOwnerId !== current.ownerAgentId) {
        const next: CaseState = {
          conversationId,
          ownerAgentId: newOwnerId,
          activeSpeakerAgentId: newOwnerId,
          protocolState: 'owner_active',
          takeoverTurns: 0,
          loopCount: current.loopCount,
          handoffCount: current.handoffCount,
        }
        events.push({
          kind: 'domain_shift',
          fromAgentId: current.ownerAgentId,
          toAgentId: newOwnerId,
          reason: `domain_changed:${detectedDomain}`,
        })
        return { caseState: next, events }
      }
    }
  }

  if (
    current.protocolState === 'owner_active' &&
    ((requestedAgentId && requestedAgentId !== current.ownerAgentId) || capabilityConsult)
  ) {
    const nextSpeaker = capabilityConsult?.agentId ?? requestedAgentId
    if (!nextSpeaker || nextSpeaker === current.ownerAgentId) {
      return { caseState: current, events }
    }
    if (current.loopCount >= MAX_CONSULT_LOOPS) {
      events.push({
        kind: 'consult_blocked',
        actorAgentId: current.ownerAgentId,
        toAgentId: nextSpeaker,
        reason: 'consult_loop_guard',
      })
      return { caseState: current, events }
    }

    const next: CaseState = {
      conversationId,
      ownerAgentId: current.ownerAgentId,
      activeSpeakerAgentId: nextSpeaker,
      protocolState: 'consult_active_takeover',
      consultTargetAgentId: nextSpeaker,
      returnTargetAgentId: current.ownerAgentId,
      consultReason: capabilityConsult?.reason ?? 'user_requested_specialist',
      takeoverTurns: 1,
      loopCount: current.loopCount + 1,
      handoffCount: current.handoffCount,
    }
    events.push({
      kind: 'consult_requested',
      actorAgentId: current.ownerAgentId,
      toAgentId: nextSpeaker,
      reason: capabilityConsult?.reason ?? 'user_requested_specialist',
    })
    events.push({
      kind: 'takeover_started',
      fromAgentId: current.ownerAgentId,
      toAgentId: nextSpeaker,
      reason: capabilityConsult?.reason ?? 'user_requested_specialist',
    })
    return { caseState: next, events }
  }

  return { caseState: current, events }
}
