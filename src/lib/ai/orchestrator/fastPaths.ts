import { AgentInput, ConsensusResult } from '../types'

export type FastPathResult = { handled: true; result: ConsensusResult } | { handled: false }

/**
 * Fast-path disabilitati.
 * Il sistema è interamente LLM-driven: keyword, pattern e regole guidano il modello
 * ma non troncano o bypassano il pipeline degli agenti.
 * Questa funzione restituisce sempre { handled: false }.
 */
export function tryAgeQuestionFastPath(_input: AgentInput): FastPathResult {
  return { handled: false }
}

/**
 * Rilevamento messaggi generici disabilitato.
 * Tutti i messaggi — inclusi saluti, brevi frasi, fillers — passano
 * attraverso il pipeline completo degli agenti per garantire risposte
 * naturali e contestuali generate dall'LLM.
 */
export function isGenericMessage(_input: AgentInput): boolean {
  return false
}
