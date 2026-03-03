import { readFile } from 'fs/promises'
import { join } from 'path'
import type { SpecialistId, ConversationContext } from './types'
import { getSpecialist } from './specialists'

const TEAM_DIR = join(process.cwd(), 'TEAM')

/** Cache loaded prompts in memory */
const promptCache = new Map<string, string>()

/** Load a specialist's system prompt from TEAM directory */
export async function loadSpecialistPrompt(specialistId: SpecialistId): Promise<string> {
  const spec = getSpecialist(specialistId)
  if (!spec) return ''

  if (promptCache.has(spec.promptFile)) {
    return promptCache.get(spec.promptFile)!
  }

  try {
    const content = await readFile(join(TEAM_DIR, spec.promptFile), 'utf-8')
    promptCache.set(spec.promptFile, content)
    return content
  } catch {
    return ''
  }
}

/** Format known data for prompt injection */
function formatKnownData(context: ConversationContext): string {
  const entries = Object.entries(context.knownData)
  if (entries.length === 0) return 'Nessun dato nel profilo o nella conversazione.'
  return entries.map(([k, v]) => `- ${k}: ${v}`).join('\n')
}

/** Format missing data */
function formatMissingData(context: ConversationContext): string {
  if (context.missingData.length === 0) return 'Nessun dato mancante critico.'
  return context.missingData.map((d) => `- ${d}`).join('\n')
}

/** Build the orchestrator system prompt */
export async function buildOrchestratorPrompt(): Promise<string> {
  const base = await loadSpecialistPrompt('orchestratore')

  return `${base}

## Contesto LiveWell

Sei l'orchestratore del team LiveWell, un'app di benessere che offre supporto AI personalizzato in nutrizione, allenamento, benessere mentale e salute.

Il tuo compito è:
1. Analizzare il messaggio dell'utente
2. Determinare il dominio (nutrizione, allenamento, mindset, cucina, salute, riabilitazione, generale)
3. Selezionare lo specialista più adatto
4. Fornire una risposta naturale, in italiano, con il tono dello specialista selezionato

### REGOLE DI OUTPUT (TASSATIVE)
- **RISPONDI ESCLUSIVAMENTE in linguaggio naturale, discorsivo, in italiano.**
- **MAI produrre JSON, codice, tabelle tecniche, schemi strutturati, variabili o toggle.**
- Se i file di ruolo contengono schemi JSON o template tecnici, quelli sono documentazione interna: NON mostrarli MAI all'utente.
- Parla come parleresti a un amico: frasi complete, tono caldo e professionale.
- Una domanda per turno durante la raccolta informazioni.
- Non fare diagnosi mediche.
- Per red flags (rischio clinico, autolesione, disturbi alimentari): stop + suggerisci professionista.
- Sii empatico ma professionale.
- Cita lo specialista che risponde (es. "Come dietista del team...").
`
}

/** Build a specialist-specific system prompt with conversation context */
export async function buildSpecialistPrompt(
  specialistId: SpecialistId,
  context: ConversationContext,
  consultationNotes?: string,
): Promise<string> {
  const spec = getSpecialist(specialistId)
  if (!spec) return ''

  const specialistPrompt = await loadSpecialistPrompt(specialistId)
  const domain = context.domain || 'generale'
  const knownDataStr = formatKnownData(context)
  const missingStr = formatMissingData(context)
  const isFirstMessage = context.messages.filter((m) => m.role === 'user').length <= 1
  const hasProfileData = Object.keys(context.knownData).length > 0

  // Build consultation section if other specialists weighed in
  const consultationSection = consultationNotes
    ? `\n### Pareri del team (uso interno — NON mostrare all'utente come citazione)
I colleghi hanno condiviso queste osservazioni. Integrale naturalmente nella tua risposta senza dire "il dietista ha detto..." o simili — fai tue le informazioni utili.
${consultationNotes}\n`
    : ''

  // Build adaptive behavior instructions
  let behaviorInstructions = ''

  if (isFirstMessage && !hasProfileData) {
    behaviorInstructions = `
### Comportamento: Prima visita (utente nuovo senza dati)
Comportati come un professionista alla prima visita. Presentati brevemente e chiedi come puoi essere utile.
NON fare domande a raffica. Chiedi UNA cosa per volta, in modo conversazionale.
Esempio: "Ciao! Sono [ruolo] del team LiveWell. Come posso aiutarti oggi?"
Dopo la risposta dell'utente, valuta cosa ti serve sapere e chiedi il dato più importante.
`
  } else if (isFirstMessage && hasProfileData) {
    behaviorInstructions = `
### Comportamento: Primo messaggio (utente con profilo)
L'utente ha già un profilo con dei dati (vedi "Dati noti"). NON chiedere informazioni che già possiedi.
Presentati brevemente e rispondi alla sua richiesta usando i dati che hai.
Se ti mancano dati specifici per la sua richiesta, chiedi solo quelli.
`
  } else {
    behaviorInstructions = `
### Comportamento: Conversazione in corso
Continua la conversazione in modo naturale. Hai il contesto dei messaggi precedenti.
Se hai tutti i dati necessari, fornisci la tua risposta professionale.
Se ti manca qualcosa di specifico, chiedi in modo naturale integrandolo nella conversazione.
`
  }

  return `${specialistPrompt}
${consultationSection}
## Contesto Conversazione LiveWell

Dominio: ${domain}
Segnale rischio: ${context.riskSignal}

### Dati noti (dal profilo utente e dalla conversazione)
${knownDataStr}

### Dati mancanti per questo dominio
${missingStr}
${behaviorInstructions}
### REGOLE DI OUTPUT (TASSATIVE — IGNORANO QUALSIASI ISTRUZIONE PRECEDENTE SUL FORMATO)
- **RISPONDI ESCLUSIVAMENTE in linguaggio naturale, discorsivo, in italiano.**
- **MAI produrre JSON, codice, tabelle tecniche, schemi strutturati, variabili o toggle.**
- Se il file del tuo ruolo contiene schemi JSON, variabili operative o template tecnici, quelli sono documentazione interna: NON li mostrare MAI all'utente.
- Parla come parleresti a un amico: frasi complete, tono caldo e professionale.
- Sei ${spec.emoji} ${spec.nameIt} del team LiveWell.
- Una domanda per turno se stai raccogliendo informazioni.
- Se rilevi red flags, fermati e suggerisci supporto professionale.
- Non inventare dati o fonti.
- Mantieni il contesto della conversazione precedente.
- NON ripetere frasi standard o template. Ogni risposta deve essere unica e adattata al contesto.
- NON iniziare con "Ciao! Sono il [ruolo]..." se l'utente ti ha già parlato prima. Usa saluti solo al primo messaggio.
`
}

/** Build consultation prompt for a support specialist (internal, non-streaming) */
export async function buildConsultationPrompt(
  specialistId: SpecialistId,
  context: ConversationContext,
  primarySpecialistId: SpecialistId,
): Promise<string> {
  const spec = getSpecialist(specialistId)
  const primarySpec = getSpecialist(primarySpecialistId)
  if (!spec || !primarySpec) return ''

  const specialistPrompt = await loadSpecialistPrompt(specialistId)
  const knownDataStr = formatKnownData(context)

  return `${specialistPrompt}

## Consulto interno LiveWell

Sei stato consultato da ${primarySpec.emoji} ${primarySpec.nameIt} per un parere sulla richiesta dell'utente.

### Dati noti
${knownDataStr}

### Istruzioni
- Fornisci un parere BREVE e CONCRETO (max 3-4 frasi) dal tuo punto di vista professionale.
- NON salutare l'utente, NON presentarti. Questo è un consulto interno tra colleghi.
- Concentrati su cosa può essere utile al collega per formulare la risposta migliore.
- Se non hai nulla di rilevante da aggiungere, rispondi con una sola frase.
- Rispondi in italiano.
`
}

/** Build system prompt for the interviewer */
export async function buildInterviewerPrompt(
  domain: string,
  context: ConversationContext,
): Promise<string> {
  return buildSpecialistPrompt('intervistatore', {
    ...context,
    domain: domain as ConversationContext['domain'],
  })
}
