import fs from 'node:fs'
import path from 'node:path'
import { parseCapabilityContract } from '../capabilities/contracts'
import { AgentProfile, AgentProfile as AgentProfileType } from '../types'
import { AgentProfileSchema, type AgentProfileFile } from './schema'

export type TeamLoaderOptions = {
  teamDirAbsolute: string // absolute path to /TEAM on server
  allowEmpty?: boolean
}

// ---------------------------------------------------------------------------
// Module-level cache — survives across calls within the same warm container.
// On serverless cold starts the cache resets automatically (no stale risk).
// Key: teamDirAbsolute, Value: loaded team snapshot.
// ---------------------------------------------------------------------------
const teamCache = new Map<string, AgentProfile[]>()

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

function safeReadJson(filePath: string): unknown {
  const raw = readUtf8(filePath)
  return JSON.parse(raw)
}

function loadOneAgent(agentDir: string): AgentProfileType {
  const profilePath = path.join(agentDir, 'profile.json')
  const parsed = AgentProfileSchema.parse(safeReadJson(profilePath)) as AgentProfileFile

  const promptPath = path.join(agentDir, parsed.systemPromptPath)
  const systemPrompt = readUtf8(promptPath)
  const capabilitiesPath = path.join(agentDir, 'capabilities.md')
  const runtimeCapabilities = fs.existsSync(capabilitiesPath)
    ? parseCapabilityContract(parsed.id, readUtf8(capabilitiesPath))
    : undefined

  const profile: AgentProfile = {
    id: parsed.id,
    displayName: parsed.displayName,
    domainTags: parsed.domainTags,
    systemPrompt,
    toolsAllowed: runtimeCapabilities?.allowedTools.length
      ? runtimeCapabilities.allowedTools
      : parsed.toolsAllowed ?? [],
    escalationRules: runtimeCapabilities?.escalationRules.length
      ? runtimeCapabilities.escalationRules
      : parsed.escalationRules ?? [],
    disclaimerStyle: parsed.disclaimerStyle ?? 'standard',
    decisionStyle: 'team-led',
    runtimeCapabilities,
  }

  return profile
}

// Collect all agent directories from TEAM root, supporting both:
// - flat:   TEAM/<agent-id>/profile.json
// - nested: TEAM/<domain-group>/<agent-id>/profile.json
function collectAgentDirs(teamDir: string): string[] {
  const dirs: string[] = []
  const entries = fs.readdirSync(teamDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const childDir = path.join(teamDir, entry.name)
    if (fs.existsSync(path.join(childDir, 'profile.json'))) {
      // Leaf agent dir (flat layout)
      dirs.push(childDir)
    } else {
      // Domain group dir — recurse one level
      const subEntries = fs.readdirSync(childDir, { withFileTypes: true })
      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue
        const subDir = path.join(childDir, sub.name)
        if (fs.existsSync(path.join(subDir, 'profile.json'))) {
          dirs.push(subDir)
        }
      }
    }
  }
  return dirs
}

export function loadTeam(opts: TeamLoaderOptions): AgentProfile[] {
  const teamDir = opts.teamDirAbsolute

  // Return cached snapshot if available (same warm container invocation).
  const cached = teamCache.get(teamDir)
  if (cached) return cached

  if (!fs.existsSync(teamDir)) {
    if (opts.allowEmpty) return []
    throw new Error(`TEAM directory not found: ${teamDir}`)
  }

  const agentDirs = collectAgentDirs(teamDir)
  const agents: AgentProfile[] = []
  const errors: string[] = []

  for (const dir of agentDirs) {
    try {
      agents.push(loadOneAgent(dir))
    } catch (err) {
      errors.push(`${path.basename(dir)}: ${(err as Error).message}`)
    }
  }

  // Hard-fail on partial/invalid TEAM to avoid silent exclusion of specialists.
  if (errors.length > 0) {
    throw new Error(`Invalid TEAM profiles detected: ${errors.join(' | ')}`)
  }

  if (agents.length === 0) {
    if (opts.allowEmpty) return []
    throw new Error(`No valid TEAM agents. Errors: ${errors.join(' | ')}`)
  }

  teamCache.set(teamDir, agents)
  return agents
}

// ---------------------------------------------------------------------------
// Clinical keywords that require specialist escalation from the generic fallback
// ---------------------------------------------------------------------------
const CLINICAL_ESCALATION_KEYWORDS = [
  // Symptoms
  'dolore', 'dolor', 'male a', 'fa male', 'mi fa male', 'ho male', 'sintom',
  'febbre', 'nausea', 'vomito', 'diarrea', 'sangue', 'sanguina',
  // Cardio
  'cuore', 'palpitaz', 'tachicard', 'aritmia', 'pressione', 'infarto',
  // Respiratory
  'fiato', 'respiro', 'dispnea', 'tosse', 'polmon',
  // Neuro
  'testa', 'cefalea', 'emicrania', 'vertigin', 'capogir', 'intorpidim',
  // Mental health severe
  'suicid', 'mi voglio fare del male', 'non voglio più vivere', 'pensieri di morte',
  'depressione', 'panico', 'attacco di panico', 'psicosi',
  // Metabolic
  'diabete', 'insulina', 'glicemia', 'tireoide', 'ormoni',
  // Musculoskeletal
  'lesion', 'infortun', 'frattura', 'tendin', 'schiena', 'articolaz',
  // Digestive
  'stomaco', 'intestin', 'colite', 'reflusso', 'gastrite',
  // Skin
  'pelle', 'prurito', 'eritema', 'dermatit', 'acne',
  // Nutrition medical
  'allergia', 'intolleranza', 'celiachia',
  // Pharmacological
  'farmac', 'medicinale', 'prescriz', 'terapia', 'diagnosi',
]

export function messageNeedsClinicalEscalation(message: string): boolean {
  const lower = message.toLowerCase()
  return CLINICAL_ESCALATION_KEYWORDS.some((kw) => lower.includes(kw))
}

export function getGenericFallbackAgent(): AgentProfile {
  return {
    id: 'generic-specialist',
    displayName: 'Assistente LiveWell',
    domainTags: ['general'],
    decisionStyle: 'team-led',
    disclaimerStyle: 'strict',
    toolsAllowed: [],
    escalationRules: [
      'Se il messaggio contiene sintomi, dolori, farmaci, diagnosi o qualsiasi tema clinico → NON rispondere nel merito: indirizzare allo specialista corretto.',
      'Se emergenza (dolore toracico, dispnea grave, pensieri suicidari, reazione allergica grave) → indicare immediatamente il 118 o il pronto soccorso.',
      'Se richiesta di prescrizioni o diagnosi mediche → rifiutare e raccomandare un professionista reale.',
    ],
    runtimeCapabilities: {
      canDo: ['Orientamento generale non clinico', 'Risposta a domande generiche su LiveWell'],
      cannotDo: [
        'Diagnosi mediche',
        'Consigli clinici su sintomi o farmaci',
        'Prescrizioni o raccomandazioni terapeutiche',
        'Qualsiasi risposta in ambito sanitario specialistico',
      ],
      consultTriggers: ['Qualsiasi tema clinico, nutrizionale specialistico, psicologico'],
      handoffTriggers: ['Richiesta esplicita di uno specialista', 'Sintomi o problemi di salute'],
      minimumInput: ['Messaggio utente'],
      outputContracts: ['Orientamento e rinvio allo specialista appropriato'],
      escalationRules: [
        'Sintomi o dolori → specialista sanitario appropriato.',
        'Emergenza → 118 / Pronto Soccorso.',
      ],
      allowedTools: [],
      artifacts: [],
    },
    systemPrompt: [
      'Sei l\'assistente di orientamento del team LiveWell.',
      'Il tuo UNICO compito è capire cosa cerca l\'utente e indirizzarlo allo specialista giusto.',
      '',
      'REGOLE ASSOLUTE:',
      '1. NON fornire mai consigli medici, clinici, nutrizionali specialistici o psicologici.',
      '2. Se il messaggio contiene sintomi, dolori, farmaci, diagnosi o temi sanitari → di\' SOLO: "Capisco. Per questa domanda ho bisogno di coinvolgere lo specialista giusto del team. Un momento."',
      '3. Se emergenza (dolore toracico intenso, difficoltà respiratoria grave, pensieri di farsi del male) → scrivi SUBITO: "Questa situazione richiede assistenza immediata. Chiama il 118 o recati al Pronto Soccorso."',
      '4. Non fingere di avere competenze specialistiche. Non sei un medico, un dietista né un coach.',
      '5. Puoi rispondere solo a domande generiche su come funziona LiveWell o su come usare l\'app.',
      '',
      'Segui team-led decision making: non agire mai unilateralmente su temi clinici.',
    ].join('\n'),
  }
}
