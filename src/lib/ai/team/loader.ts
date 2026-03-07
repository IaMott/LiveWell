import fs from 'node:fs'
import path from 'node:path'
import { AgentProfile, AgentProfile as AgentProfileType } from '../types'
import { AgentProfileSchema, type AgentProfileFile } from './schema'

export type TeamLoaderOptions = {
  teamDirAbsolute: string // absolute path to /TEAM on server
  allowEmpty?: boolean
}

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

  const profile: AgentProfile = {
    id: parsed.id,
    displayName: parsed.displayName,
    domainTags: parsed.domainTags,
    systemPrompt,
    toolsAllowed: parsed.toolsAllowed ?? [],
    escalationRules: parsed.escalationRules ?? [],
    disclaimerStyle: parsed.disclaimerStyle ?? 'standard',
    decisionStyle: 'team-led',
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

  if (agents.length === 0) {
    if (opts.allowEmpty) return []
    throw new Error(`No valid TEAM agents. Errors: ${errors.join(' | ')}`)
  }

  return agents
}

export function getGenericFallbackAgent(): AgentProfile {
  return {
    id: 'generic-specialist',
    displayName: 'Generic Specialist',
    domainTags: ['general'],
    decisionStyle: 'team-led',
    disclaimerStyle: 'standard',
    toolsAllowed: [],
    escalationRules: [
      'If the user requests medical diagnosis/prescriptions, refuse and recommend a licensed professional.',
      'If urgent self-harm or severe symptoms, recommend emergency services.',
    ],
    systemPrompt: [
      'You are a competent specialist agent.',
      'You follow team-led decision making: gather data, ask gating questions, propose safe, evidence-based steps.',
      'Never pretend to have performed actions. Only propose tool calls; the orchestrator executes tools.',
    ].join('\n'),
  }
}
