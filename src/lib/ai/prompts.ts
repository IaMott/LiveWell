import { readFile } from 'fs/promises'
import { join } from 'path'
import type { SpecialistId, Domain, ConversationContext } from './types'
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
4. Se mancano informazioni essenziali, delegare all'Intervistatore per raccogliere l'MVD
5. Fornire una risposta naturale, in italiano, con il tono dello specialista selezionato

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
): Promise<string> {
  const spec = getSpecialist(specialistId)
  if (!spec) return ''

  const specialistPrompt = await loadSpecialistPrompt(specialistId)
  const domain = context.domain || 'generale'

  const knownDataStr = Object.entries(context.knownData)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const missingStr = context.missingData.length > 0
    ? context.missingData.map((d) => `- ${d}`).join('\n')
    : 'Nessun dato mancante critico'

  return `${specialistPrompt}

## Contesto Conversazione LiveWell

Dominio: ${domain}
Stato intervista: ${context.interviewState || 'S0'}
Segnale rischio: ${context.riskSignal}

### Dati noti
${knownDataStr || 'Nessun dato ancora raccolto'}

### Dati mancanti (bloccanti)
${missingStr}

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
`
}

/** Build system prompt for the interviewer */
export async function buildInterviewerPrompt(
  domain: Domain,
  context: ConversationContext,
): Promise<string> {
  return buildSpecialistPrompt('intervistatore', {
    ...context,
    domain,
  })
}
