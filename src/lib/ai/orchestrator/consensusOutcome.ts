import type { ConsensusResult, ToolCall } from '../types'

export type ConsensusOutcomeInput = {
  consensus: ConsensusResult
}

export type ConsensusOutcome = {
  baseConsensus: Omit<ConsensusResult, 'gatingQuestions' | 'toolCallsToExecute' | 'debug'>
  gatingQuestions: string[]
  toolCallsToExecute: ToolCall[]
  conflicts: string[]
  selectedAgentsFromConsensus: string[]
}

export function adaptConsensusOutcome(input: ConsensusOutcomeInput): ConsensusOutcome {
  const { consensus } = input
  const { gatingQuestions, toolCallsToExecute, debug, ...baseConsensus } = consensus

  return {
    baseConsensus,
    gatingQuestions: [...(gatingQuestions ?? [])],
    toolCallsToExecute: [...(toolCallsToExecute ?? [])],
    conflicts: [...(debug?.conflicts ?? [])],
    selectedAgentsFromConsensus: [...(debug?.selectedAgents ?? [])],
  }
}
