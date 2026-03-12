import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AgentProfileSchema, DomainSchema } from '@/lib/ai/team/schema'
import { loadTeam } from '@/lib/ai/team/loader'

function collectProfilePaths(teamDir: string): string[] {
  const out: string[] = []
  const entries = fs.readdirSync(teamDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const first = path.join(teamDir, entry.name)
    if (fs.existsSync(path.join(first, 'profile.json'))) {
      out.push(path.join(first, 'profile.json'))
      continue
    }
    for (const sub of fs.readdirSync(first, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue
      const p = path.join(first, sub.name, 'profile.json')
      if (fs.existsSync(p)) out.push(p)
    }
  }
  return out.sort()
}

describe('TEAM domain registry hardening', () => {
  it('ensures all TEAM profiles use only canonical domain tags', () => {
    const teamDir = path.resolve(process.cwd(), 'TEAM')
    const profiles = collectProfilePaths(teamDir)
    expect(profiles.length).toBeGreaterThan(0)

    const canonicalDomains = new Set(DomainSchema.options)

    for (const profilePath of profiles) {
      const raw = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as Record<string, unknown>
      const parsed = AgentProfileSchema.safeParse(raw)
      expect(parsed.success, `Invalid profile schema: ${profilePath}`).toBe(true)
      if (!parsed.success) continue

      for (const tag of parsed.data.domainTags) {
        expect(canonicalDomains.has(tag), `Invalid domainTag '${tag}' in ${profilePath}`).toBe(true)
      }
    }
  })

  it('loads all discovered TEAM profiles without silent exclusion', () => {
    const teamDir = path.resolve(process.cwd(), 'TEAM')
    const profiles = collectProfilePaths(teamDir)
    const team = loadTeam({ teamDirAbsolute: teamDir, allowEmpty: false })

    expect(team.length).toBe(profiles.length)
  })
})
