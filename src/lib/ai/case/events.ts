import type { AgentProfile, Domain } from '../types'
import { CaseProtocolEvent } from './state'

export type CaseStreamThinkingEvent = {
  specialistName: string
  title: string
  domain?: Domain
  thought?: string
}

export function buildCaseThinkingEvents(
  events: CaseProtocolEvent[],
  team: AgentProfile[],
): CaseStreamThinkingEvent[] {
  const getName = (agentId?: string) =>
    team.find((agent) => agent.id === agentId)?.displayName ?? agentId ?? 'Team'
  const getDomain = (agentId?: string) =>
    (team.find((agent) => agent.id === agentId)?.domainTags[0] ?? 'general') as Domain

  return events.map((event) => {
    switch (event.kind) {
      case 'consult_requested':
        return {
          specialistName: getName(event.actorAgentId),
          title: `consulto richiesto a ${getName(event.toAgentId)}`,
          domain: getDomain(event.toAgentId),
          thought: 'Apro un consulto reale sul caso corrente',
        }
      case 'takeover_started':
        return {
          specialistName: getName(event.toAgentId),
          title: `prendo temporaneamente il testimone`,
          domain: getDomain(event.toAgentId),
          thought: 'Takeover temporaneo attivo',
        }
      case 'takeover_continued':
        return {
          specialistName: getName(event.actorAgentId),
          title: `continuo il takeover temporaneo`,
          domain: getDomain(event.actorAgentId),
          thought: 'Il consulto resta attivo per questo turno',
        }
      case 'return_baton':
        return {
          specialistName: getName(event.toAgentId),
          title: `riprendo il caso dopo il consulto`,
          domain: getDomain(event.toAgentId),
          thought: 'Return baton completato',
        }
      case 'handoff_requested':
        return {
          specialistName: getName(event.toAgentId),
          title: `proposta di passaggio definitivo del caso`,
          domain: getDomain(event.toAgentId),
          thought: 'Handoff permanente in attesa del prossimo checkpoint umano',
        }
      case 'handoff_completed':
        return {
          specialistName: getName(event.toAgentId),
          title: `prendo stabilmente ownership del caso`,
          domain: getDomain(event.toAgentId),
          thought: 'Handoff permanente completato',
        }
      case 'consult_blocked':
        return {
          specialistName: getName(event.actorAgentId),
          title: `consulto non riaperto per evitare loop`,
          domain: getDomain(event.actorAgentId),
          thought: 'Guardrail anti-loop attivo',
        }
      case 'initialized':
      default:
        return {
          specialistName: getName(event.actorAgentId),
          title: `prendo in carico il caso`,
          domain: getDomain(event.actorAgentId),
          thought: 'Owner del caso inizializzato',
        }
    }
  })
}
