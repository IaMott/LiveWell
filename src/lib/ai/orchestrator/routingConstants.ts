/**
 * Shared routing constants used across the orchestrator and case protocol.
 * Single source of truth — avoids duplicate regex definitions.
 */

/**
 * Explicit new-topic signal: the user has explicitly signalled a topic change.
 * When matched, the orchestrator treats the message as a new routing decision
 * rather than continuation of the current case.
 */
export const NEW_TOPIC_PATTERN =
  /\b(cambiamo argomento|passiamo a|ora invece|un'altra cosa|altro tema|nuovo problema|parliamo di altro)\b/i
