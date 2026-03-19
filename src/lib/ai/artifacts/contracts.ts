import type { AgentProfile } from '../types'

const DEFAULT_OUTPUT_INSTRUCTIONS = [
  `OUTPUT PROFESSIONALE COMPLETO:`,
  `Quando l'utente chiede un piano o documento, produce un output professionale dettagliato,`,
  `strutturato, con dati specifici (numeri, date, quantità) — non linee guida generiche.`,
  `Se mancano dati essenziali, NON finalizzare il documento: chiedi i dati mancanti oppure fornisci solo una bozza parziale chiaramente marcata come incompleta.`,
]

function buildArtifactSpecificLines(agent: AgentProfile): string[] {
  const artifacts = agent.runtimeCapabilities?.artifacts ?? []
  if (artifacts.length === 0) return DEFAULT_OUTPUT_INSTRUCTIONS

  const lines = [
    `OUTPUT PROFESSIONALE GOVERNATO — FORMATO OBBLIGATORIO:`,
    `Quando l'utente chiede un piano, una scheda, un report o una valutazione, produci un artefatto strutturato coerente con le capability dello specialista.`,
  ]

  for (const artifact of artifacts.slice(0, 3)) {
    lines.push(`- ${artifact.kind}: ${artifact.description}`)
  }

  lines.push(
    `Se i dati essenziali non sono completi, NON trasformare la risposta in un piano definitivo e NON inventare numeri specifici mancanti.`,
  )
  return lines
}

export function buildProfessionalOutputInstructions(agent: AgentProfile | undefined): string {
  if (!agent) return ''
  const lines = buildArtifactSpecificLines(agent)
  return [
    ``,
    `REGOLE OUTPUT — OBBLIGATORIE QUANDO L'UTENTE CHIEDE UN PIANO/DOCUMENTO:`,
    ...lines,
    `NON dare solo linee guida generiche. Se mancano dati essenziali, chiedi i dati mancanti oppure fornisci solo una struttura preliminare chiaramente incompleta.`,
  ].join('\n')
}
