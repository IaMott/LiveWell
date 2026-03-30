/**
 * multi-agent-routing.test.ts
 *
 * Test mirati su ROUTING e AGENT SELECTION del sistema multi-agente.
 * Copre: tutti i 11 cluster sintomatici, selezione agenti con scoring,
 * rilevamento specialista esplicito, uscita dalla modalità specialista.
 */

import { describe, expect, it } from 'vitest'
import type { AgentProfile } from '@/lib/ai/types'
import {
  detectMultiSpecialistNeed,
  detectSpecialistRequest,
  resolveRoutingCandidates,
  shouldExitSpecialistMode,
} from '@/lib/ai/orchestrator/routing'
import { selectAgentsForRequest } from '@/lib/ai/orchestrator/agentSelection'

// ─── Team completo per tutti i cluster ────────────────────────────────────────

function agent(
  id: string,
  displayName: string,
  domainTags: AgentProfile['domainTags'],
): AgentProfile {
  return {
    id,
    displayName,
    domainTags,
    systemPrompt: 'x',
    toolsAllowed: [],
    decisionStyle: 'team-led',
  }
}

const FULL_TEAM: AgentProfile[] = [
  // Salute biologica
  agent('mmg', 'Medico di Base', ['health']),
  agent('cardiologo', 'Cardiologo', ['health']),
  agent('endocrinologo', 'Endocrinologo', ['health']),
  agent('fisioterapista', 'Fisioterapista', ['health', 'training']),
  agent('fisiatra', 'Fisiatra', ['health']),
  agent('dermatologo', 'Dermatologo', ['health']),
  agent('gastroenterologo', 'Gastroenterologo', ['health']),
  agent('medico-dello-sport', 'Medico dello Sport', ['health', 'training']),
  // Allenamento
  agent('persona-trainer', 'Personal Trainer', ['training']),
  agent('chinesologo', 'Chinesologo', ['training']),
  // Nutrizione
  agent('dietista', 'Dietista', ['nutrition']),
  agent('chef', 'Chef', ['nutrition']),
  // Salute mentale
  agent('psicologo', 'Psicologo', ['mindfulness']),
  agent('mental-coach', 'Mental Coach', ['mindfulness']),
  agent('sleep-coach', 'Coach del Sonno', ['mindfulness', 'health']),
  agent('relationship-coach', 'Relationship Coach', ['mindfulness']),
  // Coordinamento / idee
  agent('life-organizer', 'Life Organizer', ['coordination']),
  agent('analista-contesto', 'Analista di Contesto', ['coordination', 'general']),
]

// ─── 1. Cluster Cardiometabolico ──────────────────────────────────────────────

describe('Cluster: Cardiometabolico', () => {
  it('seleziona cardiologo + endocrinologo per sintomi cardiaci + stanchezza + peso', () => {
    const result = detectMultiSpecialistNeed(
      'ho tachicardia, sono sempre stanco e sto ingrassando',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('cardiologo')
    expect(ids).toContain('endocrinologo')
    expect(result!.urgency).toBe('alta')
  })

  it('non si attiva con solo stanchezza e peso (manca segnale cardiaco)', () => {
    const result = detectMultiSpecialistNeed('sono stanco e sto ingrassando', FULL_TEAM)
    // Possibile anche null — non deve obbligatoriamente includere cardiologo
    if (result) {
      const ids = result.specialists.map((s) => s.id)
      expect(ids).not.toContain('cardiologo')
    }
  })
})

// ─── 2. Cluster Sleep-Metabolism ──────────────────────────────────────────────

describe('Cluster: Sleep-Metabolism', () => {
  it('seleziona endocrinologo + sleep-coach per sonno + stanchezza + peso', () => {
    const result = detectMultiSpecialistNeed(
      'dormo male, sono sempre stanco e non perdo peso',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('endocrinologo')
    expect(ids).toContain('sleep-coach') // Verifica fix bug P1: era 'coach-del-sonno'
  })

  it('si attiva con varianti di sonno disturbato', () => {
    const result = detectMultiSpecialistNeed(
      'ho insonnia, mi sento esaurito e il metabolismo è lento',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('sleep-coach')
  })

  it('urgency è media per questo cluster', () => {
    const result = detectMultiSpecialistNeed(
      'non riesco a dormire, sono stanc e non perdo peso',
      FULL_TEAM,
    )
    expect(result?.urgency).toBe('media')
  })
})

// ─── 3. Cluster Riabilitativo ─────────────────────────────────────────────────

describe('Cluster: Riabilitativo', () => {
  it('seleziona fisioterapista + fisiatra per dolore + movimento', () => {
    const result = detectMultiSpecialistNeed(
      'ho dolore alla schiena e ho limitazioni nei movimenti',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('fisioterapista')
    expect(ids).toContain('fisiatra')
  })

  it('si attiva con trauma + riabilitazione', () => {
    const result = detectMultiSpecialistNeed(
      'ho avuto un trauma al ginocchio e devo recuperare la mobilità',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('fisioterapista')
  })
})

// ─── 4. Cluster Sport-Nutrizione ──────────────────────────────────────────────

describe('Cluster: Sport-Nutrizione', () => {
  it('seleziona dietista + persona-trainer per alimentazione + allenamento', () => {
    const result = detectMultiSpecialistNeed(
      'cosa mangio prima e dopo l allenamento in palestra?',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('dietista')
    expect(ids).toContain('persona-trainer')
  })

  it('si attiva con dieta + performance atletica', () => {
    const result = detectMultiSpecialistNeed(
      'voglio ottimizzare la nutrizione per la mia performance nella corsa',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('dietista')
  })
})

// ─── 5. Cluster Psico-Lavoro ──────────────────────────────────────────────────

describe('Cluster: Psico-Lavoro', () => {
  it('seleziona psicologo + mental-coach per ansia + lavoro', () => {
    const result = detectMultiSpecialistNeed(
      'ho molta ansia per il lavoro e non riesco a calmarmi prima delle riunioni',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('psicologo')
    expect(ids).toContain('mental-coach')
  })

  it('si attiva con burnout professionale', () => {
    const result = detectMultiSpecialistNeed(
      'sono in burnout, troppo stress legato al lavoro e ai colleghi',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('psicologo')
  })
})

// ─── 6. Cluster Pressione-Cefalea ─────────────────────────────────────────────

describe('Cluster: Pressione-Cefalea', () => {
  it('seleziona cardiologo + mmg per pressione alta + mal di testa', () => {
    const result = detectMultiSpecialistNeed(
      'ho la pressione alta e soffro di emicrania forte',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('cardiologo')
    expect(ids).toContain('mmg')
    expect(result!.urgency).toBe('alta')
  })
})

// ─── 7. Cluster Psico-Relazionale ────────────────────────────────────────────

describe('Cluster: Psico-Relazionale', () => {
  it('seleziona psicologo + relationship-coach per tristezza + coppia', () => {
    const result = detectMultiSpecialistNeed(
      'sono molto triste per la mia relazione di coppia che sta andando male',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('psicologo')
    expect(ids).toContain('relationship-coach')
  })
})

// ─── 8. Cluster Gut-Skin Axis ─────────────────────────────────────────────────

describe('Cluster: Gut-Skin Axis', () => {
  it('seleziona dermatologo + gastroenterologo per pelle + intestino', () => {
    const result = detectMultiSpecialistNeed(
      'ho eczema con prurito e il gonfiore intestinale dopo i pasti',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('dermatologo')
    expect(ids).toContain('gastroenterologo')
  })
})

// ─── 9. Cluster Muscolare-Atletico ───────────────────────────────────────────

describe('Cluster: Muscolare-Atletico', () => {
  it('seleziona medico-dello-sport + persona-trainer per DOMS + allenamento', () => {
    const result = detectMultiSpecialistNeed(
      'ho muscoli dolenti e doms dopo il workout in palestra',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('medico-dello-sport')
    expect(ids).toContain('persona-trainer')
  })
})

// ─── 10. Cluster Ormonale ────────────────────────────────────────────────────

describe('Cluster: Ormonale', () => {
  it('seleziona endocrinologo + mmg per ciclo + sbalzi umore + peso', () => {
    const result = detectMultiSpecialistNeed(
      'il ciclo è irregolare e ho sbalzi d umore e gonfiore',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('endocrinologo')
    expect(ids).toContain('mmg')
  })

  it('si attiva con squilibrio ormonale + stanchezza', () => {
    const result = detectMultiSpecialistNeed(
      'credo di avere un squilibrio ormonale: sono sempre stanca e ho variazioni di peso',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
  })
})

// ─── 11. Cluster Stress-Organizzativo ────────────────────────────────────────

describe('Cluster: Stress-Organizzativo', () => {
  it('seleziona life-organizer + mental-coach per sovraccarico + gestione tempo', () => {
    const result = detectMultiSpecialistNeed(
      'sono sopraffatto e non riesco a gestire tutto, ho troppi impegni e non so da dove iniziare',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('life-organizer')
    expect(ids).toContain('mental-coach')
  })
})

// ─── 12. Nessun cluster — selezione per dominio ──────────────────────────────

describe('No cluster → selezione per dominio', () => {
  it('query nutrizione senza segnali atletici → dietista (no cluster)', () => {
    const result = detectMultiSpecialistNeed('vorrei migliorare la mia dieta quotidiana', FULL_TEAM)
    // Nessun cluster dovrebbe attivarsi (manca secondo gruppo)
    if (result) {
      expect(result.specialists.map((s) => s.id)).not.toContain('fisioterapista')
    }
  })

  it('cluster non si attiva se manca uno dei gruppi AND', () => {
    // Gruppo sonno sì, stanchezza sì, ma manca peso/metabolismo
    const result = detectMultiSpecialistNeed('dormo male e sono stanco', FULL_TEAM)
    // Sleep-metabolism richiede TUTTI e 3 i gruppi: sonno + stanchezza + peso/metabolismo
    // Senza il terzo gruppo non deve attivarsi
    expect(result).toBeNull()
  })

  it('cluster SI attiva quando tutti e 3 i gruppi AND sono presenti (complementare)', () => {
    // Aggiungere il 3° gruppo (metabolismo/peso) fa scattare il cluster
    const result = detectMultiSpecialistNeed(
      'dormo male, sono stanco e non riesco a perdere peso',
      FULL_TEAM,
    )
    expect(result).not.toBeNull()
    const ids = result!.specialists.map((s) => s.id)
    expect(ids).toContain('sleep-coach')
    expect(ids).toContain('endocrinologo')
  })
})

// ─── 13. detectSpecialistRequest ────────────────────────────────────────────

describe('detectSpecialistRequest', () => {
  it('rileva richiesta esplicita per dietista tramite keyword SPECIALIST_KEYWORDS', () => {
    const id = detectSpecialistRequest('voglio parlare con la dietista', FULL_TEAM)
    expect(id).toBe('dietista')
  })

  it('rileva psicologo tramite keyword', () => {
    const id = detectSpecialistRequest('voglio il psicologo', FULL_TEAM)
    expect(id).toBe('psicologo')
  })

  it('rileva personal trainer tramite keyword "personal trainer"', () => {
    const id = detectSpecialistRequest('passami il personal trainer', FULL_TEAM)
    expect(id).toBe('persona-trainer')
  })

  it('rileva sleep coach tramite keyword "coach del sonno"', () => {
    const id = detectSpecialistRequest('voglio il coach del sonno', FULL_TEAM)
    expect(id).toBe('sleep-coach')
  })

  it('rileva mmg tramite "medico di base"', () => {
    const id = detectSpecialistRequest('vorrei parlare con il medico di base', FULL_TEAM)
    expect(id).toBe('mmg')
  })

  it('ritorna null per messaggio generico', () => {
    const id = detectSpecialistRequest('ho mal di testa', FULL_TEAM)
    expect(id).toBeNull()
  })

  it('rileva per displayName con REQUEST_VERB (fallback)', () => {
    const id = detectSpecialistRequest('voglio parlare con la Dietista', FULL_TEAM)
    expect(id).toBe('dietista')
  })
})

// ─── 14. shouldExitSpecialistMode ────────────────────────────────────────────

describe('shouldExitSpecialistMode', () => {
  it('rileva "torna al team"', () => {
    expect(shouldExitSpecialistMode('torna al team')).toBe(true)
  })

  it('rileva "basta specialista"', () => {
    expect(shouldExitSpecialistMode('basta specialista')).toBe(true)
  })

  it('rileva "chiudi specialista"', () => {
    expect(shouldExitSpecialistMode('chiudi specialista')).toBe(true)
  })

  it('non attiva su messaggio normale', () => {
    expect(shouldExitSpecialistMode('ho ancora domande sulla dieta')).toBe(false)
  })
})

// ─── 15. resolveRoutingCandidates ────────────────────────────────────────────

describe('resolveRoutingCandidates', () => {
  it('cluster urgency=alta → include tutti gli specialisti del cluster (non slice 2)', () => {
    // Cluster cardiometabolico urgency=alta → entrambi gli specialisti devono esserci
    const { selectedAgents } = resolveRoutingCandidates({
      team: FULL_TEAM,
      message: 'ho tachicardia, sono sempre stanco e sto ingrassando',
      detectedDomain: 'health',
      allDomains: ['health'],
    })
    const ids = selectedAgents.map((a) => a.id)
    expect(ids).toContain('cardiologo')
    expect(ids).toContain('endocrinologo')
    // Verifica che il cluster urgency=alta NON limiti a 2 — deve contenere ≥2 specialisti
    expect(ids.length).toBeGreaterThanOrEqual(2)
  })

  it('cluster urgency=media → include i primi 2 specialisti del cluster', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team: FULL_TEAM,
      message: 'dormo male, sono sempre stanco e non perdo peso',
      detectedDomain: 'health',
      allDomains: ['health', 'mindfulness'],
    })
    const ids = selectedAgents.map((a) => a.id)
    expect(ids).toContain('endocrinologo')
    expect(ids).toContain('sleep-coach')
  })

  it('con currentSpeakerId → quel agente è primo, multi-domain permette più agenti', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team: FULL_TEAM,
      message: 'ho mal di schiena e voglio capire come allenarmi meglio',
      detectedDomain: 'health',
      allDomains: ['health', 'training'],
      currentSpeakerId: 'fisioterapista',
    })
    expect(selectedAgents[0]?.id).toBe('fisioterapista')
    // Multi-domain with active speaker: up to 2 agents per domain + active, max 6
    expect(selectedAgents.length).toBeLessThanOrEqual(6)
    expect(selectedAgents.length).toBeGreaterThanOrEqual(2)
  })

  it('preferisce gli agenti indicati dal contesto anche senza keyword forti nel messaggio', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team: FULL_TEAM,
      message: 'continuiamo pure',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition', 'health'],
      preferredAgentIds: ['dietista', 'cardiologo'],
    })

    const ids = selectedAgents.map((a) => a.id)
    expect(ids[0]).toBe('dietista')
    expect(ids).toContain('cardiologo')
  })

  it('decisionTrace non è vuoto', () => {
    const { decisionTrace } = resolveRoutingCandidates({
      team: FULL_TEAM,
      message: 'voglio un piano alimentare',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
    })
    expect(decisionTrace.length).toBeGreaterThan(0)
  })

  it('senza cluster: dominio nutrition → dietista selezionato', () => {
    const { selectedAgents } = resolveRoutingCandidates({
      team: FULL_TEAM,
      message: 'vorrei un piano alimentare per dimagrire',
      detectedDomain: 'nutrition',
      allDomains: ['nutrition'],
    })
    expect(selectedAgents.some((a) => a.id === 'dietista')).toBe(true)
  })
})

// ─── 16. selectAgentsForRequest — scoring ────────────────────────────────────

describe('selectAgentsForRequest — scoring', () => {
  it('dominio health + parola "schiena" → fisioterapista ha punteggio alto', () => {
    const agents = selectAgentsForRequest(
      FULL_TEAM,
      'health',
      4,
      ['health'],
      'ho dolore alla schiena',
    )
    const ids = agents.map((a) => a.id)
    expect(ids).toContain('fisioterapista')
  })

  it('dominio training + "postura schema motorio" → chinesologo selezionato', () => {
    const agents = selectAgentsForRequest(
      FULL_TEAM,
      'training',
      4,
      ['training'],
      'ho problemi di postura e voglio migliorare il mio schema motorio',
    )
    const ids = agents.map((a) => a.id)
    expect(ids).toContain('chinesologo') // Verifica fix bug P2: era 'chinesiologo'
  })

  it('F3: agenti con score ≤ 2 vengono esclusi', () => {
    // dominio nutrition → dietista/chef score alto; psicologo score 0 (non ha domainTag nutrition)
    const agents = selectAgentsForRequest(
      FULL_TEAM,
      'nutrition',
      6,
      ['nutrition'],
      'voglio una dieta',
    )
    const ids = agents.map((a) => a.id)
    expect(ids).not.toContain('psicologo')
    expect(ids).not.toContain('fisioterapista')
  })

  it('menzione esplicita del nome agente aumenta score', () => {
    // "cardiologo" esplicitamente citato
    const agents = selectAgentsForRequest(
      FULL_TEAM,
      'health',
      6,
      ['health'],
      'voglio parlare con il cardiologo per il mio cuore',
    )
    const ids = agents.map((a) => a.id)
    expect(ids[0]).toBe('cardiologo')
  })

  it('max agenti rispettato', () => {
    const agents = selectAgentsForRequest(FULL_TEAM, 'health', 3, ['health'], 'ho sintomi')
    expect(agents.length).toBeLessThanOrEqual(3)
  })

  it('musculoskeletal keywords select relevant specialists via competence hints', () => {
    const agents = selectAgentsForRequest(
      FULL_TEAM,
      'health',
      6,
      ['health'],
      'ho dolore muscolare alla colonna',
    )
    const ids = agents.map((a) => a.id)
    // Both fisioterapista and fisiatra have competence hints matching 'muscolo'/'colonna'
    // They should be selected without any hardcoded bonus — just competence hints
    expect(ids).toContain('fisioterapista')
    expect(ids).toContain('fisiatra')
  })

  it('prioritizes preferredAgentIds over competence-hint-only boosts', () => {
    const agents = selectAgentsForRequest(
      FULL_TEAM,
      'nutrition',
      4,
      ['nutrition', 'health'],
      'continuiamo pure',
      '',
      {},
      { preferredAgentIds: ['dietista'] },
    )

    expect(agents[0]?.id).toBe('dietista')
  })
})
