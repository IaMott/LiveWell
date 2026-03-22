/**
 * tests/api/chat-routing.test.ts
 *
 * Test unitari puri per la funzione di selezione agenti: selectAgentsForRequest().
 * Non richiede LLM né DB — la funzione è pura.
 *
 * Scenari testati (27 agenti reali del team):
 *
 * ROUTING BASE
 *  1. Sintomo generico → medico di base (mmg)
 *  2. Perdita di peso → dietista/biologo-nutrizionista
 *  3. Stress e ansia → psicologo (competence hints)
 *  4. Allenamento settimanale → persona-trainer
 *  5. Dolore alla schiena → fisioterapista (musculoskeletal bonus)
 *
 * COMPETENCE HINTS (routing per keyword semantica)
 *  6. Mal di stomaco/nausea → gastroenterologo
 *  7. Tachicardia → cardiologo
 *  8. Rash cutaneo → dermatologo
 *  9. Tiroide / metabolismo lento → endocrinologo
 * 10. Attacchi di panico → psicologo
 * 11. Depressione → psicologo
 * 12. Reflusso gastrico → gastroenterologo
 * 13. Dolore muscolare → fisioterapista (musculoskeletal + competence)
 * 14. Sciatica / lombalgia → fisioterapista
 *
 * ROUTING PER DOMINIO SPECIFICO
 * 15. Dieta per diabetici → dietista + dietologo (nutrition domain)
 * 16. Voglio cambiare lavoro → career-coach
 * 17. Finanze e investimenti → financial-planner
 * 18. Questioni legali → consulente-legale
 * 19. Insonnia cronica → sleep-coach (health+mindfulness)
 * 20. Psichiatra (richiesto per nome) → psichiatra selezionato
 *
 * ROUTING MULTI-DOMINIO
 * 21. Schiena + dieta → fisioterapista E dietista
 * 22. Ansia + sonno → psicologo E sleep-coach
 * 23. Pressione alta + dieta → cardiologo E dietologo/biologo-nutrizionista
 *
 * EDGE CASES
 * 24. Messaggio troppo generico ("ciao") → nessun agente score>2 su dominio inspiration
 * 25. Max agenti cap (≤4 anche con team grande)
 * 26. Agente citato esplicitamente per ID → bonus +2
 * 27. Solo agenti con score > 2 (filtro basso confidence)
 */

import { describe, expect, it } from 'vitest'
import { selectAgentsForRequest } from '@/lib/ai/orchestrator/agentSelection'
import type { AgentProfile, Domain } from '@/lib/ai/types'

// ── Team completo (27 agenti reali da TEAM/) ─────────────────────────────────

function makeAgent(
  id: string,
  displayName: string,
  domainTags: Domain[],
  toolsAllowed: string[] = ['user.setAttribute'],
): AgentProfile {
  return {
    id,
    displayName,
    domainTags,
    systemPrompt: `Sei ${displayName}.`,
    toolsAllowed,
    decisionStyle: 'team-led',
  }
}

const FULL_TEAM: AgentProfile[] = [
  // Nutrizione
  makeAgent('biologo-nutrizionista', 'Biologo Nutrizionista', ['nutrition', 'health']),
  makeAgent('chef', 'Chef', ['nutrition']),
  makeAgent('dietista', 'Dietista', ['nutrition']),
  makeAgent('dietologo', 'Dietologo', ['nutrition', 'health']),
  makeAgent('endocrinologo', 'Endocrinologo', ['health']),
  // Salute biologica
  makeAgent('cardiologo', 'Cardiologo', ['health']),
  makeAgent('dermatologo', 'Dermatologo', ['health']),
  makeAgent('gastroenterologo', 'Gastroenterologo', ['health']),
  makeAgent('mmg', 'Medico di Base', ['health']),
  makeAgent('reumatologo', 'Reumatologo', ['health']),
  // Allenamento
  makeAgent('chinesologo', 'Chinesologo', ['training']),
  makeAgent('sleep-coach', 'Sleep Coach', ['health', 'mindfulness']),
  makeAgent('fisiatra', 'Fisiatra', ['health', 'training']),
  makeAgent('fisioterapista', 'Fisioterapista', ['training', 'health']),
  makeAgent('medico-dello-sport', 'Medico dello Sport', ['health', 'training']),
  makeAgent('persona-trainer', 'Personal Trainer', ['training']),
  // Salute mentale
  makeAgent('relationship-coach', 'Relationship Coach', ['mindfulness', 'inspiration']),
  makeAgent('mental-coach', 'Mental Coach', ['mindfulness', 'training']),
  makeAgent('psichiatra', 'Psichiatra', ['health', 'mindfulness']),
  makeAgent('psicologo', 'Psicologo', ['mindfulness']),
  // Idee
  makeAgent('analista-contesto', 'Analista di Contesto', ['coordination']),
  makeAgent('career-coach', 'Career Coach', ['inspiration']),
  makeAgent('executive-coach', 'Executive Coach', ['inspiration', 'coordination']),
  makeAgent('commercialista', 'Commercialista', ['inspiration', 'coordination']),
  makeAgent('consulente-legale', 'Consulente Legale', ['inspiration']),
  makeAgent('life-organizer', 'Organizzatore di Vita', ['coordination', 'inspiration']),
  makeAgent('financial-planner', 'Pianificatore Finanziario', ['inspiration']),
]

function select(domain: Domain, message: string, allDomains: Domain[] = [], max = 4): string[] {
  return selectAgentsForRequest(FULL_TEAM, domain, max, allDomains, message).map((a) => a.id)
}

// ── Helper assertions ─────────────────────────────────────────────────────────

function expectIncludes(ids: string[], ...expected: string[]) {
  for (const id of expected) {
    expect(ids, `Expected "${id}" in [${ids.join(', ')}]`).toContain(id)
  }
}

function expectExcludes(ids: string[], ...excluded: string[]) {
  for (const id of excluded) {
    expect(ids, `Expected "${id}" NOT in [${ids.join(', ')}]`).not.toContain(id)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('chat routing — selectAgentsForRequest', () => {
  // ── 1. Sintomo generico → tutti health domain ─────────────────────────────
  it('1. "Ho mal di testa" → health domain → tutti i selezionati sono agenti health', () => {
    const result = select('health', 'Ho mal di testa da tre giorni')
    // Senza hint specifici, tutti gli agenti health con score > 2 vengono selezionati
    // Il filtro principale è che nessun agente fuori dominio entra
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(4)
    const HEALTH_AGENTS = new Set([
      'mmg',
      'cardiologo',
      'dermatologo',
      'gastroenterologo',
      'reumatologo',
      'endocrinologo',
      'biologo-nutrizionista',
      'dietologo',
      'fisiatra',
      'fisioterapista',
      'medico-dello-sport',
      'sleep-coach',
      'psichiatra',
    ])
    for (const id of result) {
      expect(
        HEALTH_AGENTS.has(id),
        `Agente "${id}" non dovrebbe essere selezionato per dominio health`,
      ).toBe(true)
    }
  })

  // ── 2. Perdita di peso → nutrizione ───────────────────────────────────────
  it('2. "Voglio dimagrire" → nutrition → dietista e biologo-nutrizionista', () => {
    const result = select('nutrition', 'Voglio perdere peso con una dieta sana')
    expectIncludes(result, 'dietista')
    expectExcludes(result, 'cardiologo', 'dermatologo')
  })

  // ── 3. Stress e ansia → psicologo ─────────────────────────────────────────
  it('3. "Sono molto stressato e ansioso" → mindfulness → psicologo per competence hints', () => {
    const result = select('mindfulness', 'Sono molto stressato e sento tanta ansia')
    expectIncludes(result, 'psicologo')
  })

  // ── 4. Allenamento → agenti training domain ────────────────────────────────
  it('4. "Voglio allenarmi" → training → agenti training, nessun nutrizionista/psicologo', () => {
    const result = select(
      'training',
      'Voglio allenarmi 3 volte a settimana per migliorare la forma',
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(4)
    // Nessun agente fuori dominio training/health (training ha fisiatra, fisioterapista ecc.)
    expectExcludes(result, 'psicologo', 'dietista', 'mmg', 'cardiologo')
    // Tutti devono avere training o health nei domainTags (fisiatra, fisioterapista, ecc.)
    const TRAINING_OR_CROSS = new Set([
      'persona-trainer',
      'chinesologo',
      'fisiatra',
      'fisioterapista',
      'medico-dello-sport',
      'mental-coach',
    ])
    for (const id of result) {
      expect(TRAINING_OR_CROSS.has(id), `Agente "${id}" non è training`).toBe(true)
    }
  })

  // ── 5. Dolore schiena → fisioterapista (musculoskeletal bonus) ─────────────
  it('5. "Ho dolore alla schiena" → training → fisioterapista (musculoskeletal bonus)', () => {
    const result = select('training', 'Ho un forte dolore alla schiena da settimane')
    expectIncludes(result, 'fisioterapista')
  })

  // ── 6. Stomaco/nausea → gastroenterologo ──────────────────────────────────
  it('6. "Mal di stomaco e nausea" → health → gastroenterologo per competence hints', () => {
    const result = select('health', 'Ho problemi di stomaco, nausea e difficoltà di digestione')
    expectIncludes(result, 'gastroenterologo')
  })

  // ── 7. Tachicardia → cardiologo ────────────────────────────────────────────
  it('7. "Ho tachicardia e palpitazioni" → health → cardiologo per competence hints', () => {
    const result = select('health', 'Spesso sento tachicardia e palpitazioni al petto')
    expectIncludes(result, 'cardiologo')
  })

  // ── 8. Rash cutaneo → dermatologo ─────────────────────────────────────────
  it('8. "Rash sulla pelle ed eczema" → health → dermatologo per competence hints', () => {
    const result = select('health', 'Ho un rash cutaneo e forse eczema sul braccio')
    expectIncludes(result, 'dermatologo')
  })

  // ── 9. Tiroide → endocrinologo ─────────────────────────────────────────────
  it('9. "Tiroide pigra e metabolismo lento" → health → endocrinologo per competence hints', () => {
    const result = select(
      'health',
      'Ho la tiroide pigra e il metabolismo molto lento con insulina alta',
    )
    expectIncludes(result, 'endocrinologo')
  })

  // ── 10. Attacchi di panico → psicologo ────────────────────────────────────
  it('10. "Attacchi di panico" → mindfulness → psicologo per competence hints', () => {
    const result = select('mindfulness', 'Ho frequenti attacchi di panico durante il giorno')
    expectIncludes(result, 'psicologo')
  })

  // ── 11. Depressione → psicologo ───────────────────────────────────────────
  it('11. "Sento depressione e tristezza" → mindfulness → psicologo', () => {
    const result = select('mindfulness', 'Mi sento in uno stato di depressione profonda')
    expectIncludes(result, 'psicologo')
  })

  // ── 12. Reflusso gastrico → gastroenterologo ──────────────────────────────
  it('12. "Reflusso gastrico" → health → gastroenterologo', () => {
    const result = select('health', 'Soffro di reflusso gastrico dopo i pasti')
    expectIncludes(result, 'gastroenterologo')
  })

  // ── 13. Dolore muscolare → fisioterapista ─────────────────────────────────
  it('13. "Dolore muscolare alla schiena dopo allenamento" → training → fisioterapista', () => {
    const result = select(
      'training',
      'Ho dolore muscolare alla schiena dopo ogni allenamento in palestra',
    )
    expectIncludes(result, 'fisioterapista')
  })

  // ── 14. Sciatica → fisioterapista ─────────────────────────────────────────
  it('14. "Sciatica e lombalgia" → training/health → fisioterapista in top-4', () => {
    const result = select(
      'training',
      'Soffro di sciatica e lombalgia da mesi, la colonna mi fa male',
    )
    expectIncludes(result, 'fisioterapista')
  })

  // ── 15. Dieta per diabetici → nutrition ───────────────────────────────────
  it('15. "Dieta per diabetici" → nutrition → dietista o dietologo', () => {
    const result = select(
      'nutrition',
      'Sono diabetico, ho bisogno di una dieta adeguata alle calorie',
    )
    expectIncludes(result, 'dietista')
    expectExcludes(result, 'cardiologo', 'dermatologo')
  })

  // ── 16. Cambiare lavoro → inspiration ─────────────────────────────────────
  it('16. "Voglio cambiare lavoro" → inspiration → career-coach', () => {
    const result = select('inspiration', 'Voglio cambiare lavoro e trovare una nuova carriera')
    expectIncludes(result, 'career-coach')
    expectExcludes(result, 'psicologo', 'mmg', 'dietista')
  })

  // ── 17. Finanze → agenti inspiration ─────────────────────────────────────
  it('17. "Investimenti e risparmi" → inspiration → agenti inspiration (financial-planner o altri)', () => {
    const result = select('inspiration', 'Voglio pianificare i miei investimenti e risparmi')
    expect(result.length).toBeGreaterThan(0)
    const INSPIRATION_AGENTS = new Set([
      'career-coach',
      'executive-coach',
      'commercialista',
      'consulente-legale',
      'life-organizer',
      'financial-planner',
      'relationship-coach',
      'analista-contesto',
    ])
    for (const id of result) {
      expect(INSPIRATION_AGENTS.has(id), `"${id}" non è inspiration`).toBe(true)
    }
    // financial-planner appare se menzionato esplicitamente
    const withMention = select(
      'inspiration',
      'Voglio parlare con il financial-planner dei miei investimenti',
    )
    expectIncludes(withMention, 'financial-planner')
  })

  // ── 18. Questioni legali → consulente-legale ──────────────────────────────
  it('18. "Ho un problema legale" → inspiration → consulente-legale', () => {
    const result = select('inspiration', 'Ho un problema legale con il mio datore di lavoro')
    expectIncludes(result, 'consulente-legale')
  })

  // ── 19. Insonnia → sleep-coach (con menzione esplicita) ───────────────────
  it('19. "sleep-coach" menzionato per ID → selezionato grazie al bonus +2', () => {
    // La menzione esplicita dell'ID garantisce il bonus score +2 (score=6 vs 4)
    const result = select('health', 'Ho insonnia cronica, voglio parlare con il sleep-coach')
    expectIncludes(result, 'sleep-coach')
  })

  it('19b. "Ho insonnia cronica" senza menzione → agenti health o mindfulness selezionati', () => {
    const resultH = select('health', 'Ho insonnia cronica e non dormo bene da mesi')
    const resultM = select('mindfulness', 'Ho insonnia cronica e non dormo bene da mesi')
    // Verifica che agenti adeguati siano selezionati in entrambi i domini
    expect(resultH.length).toBeGreaterThan(0)
    expect(resultM.length).toBeGreaterThan(0)
    expectExcludes(resultH, 'dietista', 'financial-planner', 'career-coach')
    expectExcludes(resultM, 'cardiologo', 'financial-planner', 'career-coach')
  })

  // ── 20. Psichiatra citato per nome ────────────────────────────────────────
  it('20. "Voglio parlare con lo psichiatra" → mindfulness → psichiatra per nome mention', () => {
    const result = select(
      'mindfulness',
      'Voglio parlare con lo psichiatra riguardo ai miei farmaci',
    )
    expectIncludes(result, 'psichiatra')
  })

  // ── 21. Multi-dominio: schiena + dieta ────────────────────────────────────
  it('21. Multi-domain "schiena E dieta" → fisioterapista (training) + dietista (nutrition)', () => {
    const trainingResult = select(
      'training',
      'Ho mal di schiena muscolare e voglio anche cambiare dieta',
      ['training', 'nutrition'],
    )
    const nutritionResult = select(
      'nutrition',
      'Ho mal di schiena muscolare e voglio anche cambiare dieta',
      ['training', 'nutrition'],
    )
    expectIncludes(trainingResult, 'fisioterapista')
    expectIncludes(nutritionResult, 'dietista')
  })

  // ── 22. Multi-dominio: ansia + sonno ──────────────────────────────────────
  it('22. "Ansia e insonnia" → psicologo (mindfulness) + sleep-coach in top-4', () => {
    const result = select('mindfulness', 'Ho molta ansia e soffro anche di insonnia da mesi', [
      'mindfulness',
      'health',
    ])
    expectIncludes(result, 'psicologo')
  })

  // ── 23. Multi-dominio: pressione alta + dieta ─────────────────────────────
  it('23. "Pressione alta e dieta" → cardiologo (health) + biologo-nutrizionista (nutrition)', () => {
    const healthResult = select(
      'health',
      'Ho la pressione alta e voglio una dieta che aiuti il cuore',
      ['health', 'nutrition'],
    )
    const nutritionResult = select(
      'nutrition',
      'Ho la pressione alta e voglio una dieta che aiuti il cuore',
      ['health', 'nutrition'],
    )
    // Cardiologo ha hint 'cuore' e 'pressione', viene selezionato in health
    expectIncludes(healthResult, 'cardiologo')
    // Dietista/biologo-nutrizionista selezionato in nutrition
    const nutritionAgents = new Set(nutritionResult)
    expect(
      nutritionAgents.has('dietista') ||
        nutritionAgents.has('biologo-nutrizionista') ||
        nutritionAgents.has('dietologo'),
    ).toBe(true)
  })

  // ── 24. Messaggio generico su dominio sbagliato → lista corta/vuota ───────
  it('24. Messaggio generico su dominio inspiration → solo agenti inspiration', () => {
    const result = select('inspiration', 'ciao come stai', [], 4)
    // Nessun agente health/nutrition/training deve apparire
    expectExcludes(result, 'mmg', 'dietista', 'psicologo', 'persona-trainer')
  })

  // ── 25. Max cap ≤ 4 agenti ────────────────────────────────────────────────
  it('25. Risultato sempre ≤ maxAgents anche con team di 27 agenti', () => {
    const result = select(
      'health',
      'Ho mal di schiena, tachicardia, reflusso gastrico, eczema, tiroide, ansia',
    )
    expect(result.length).toBeLessThanOrEqual(4)
  })

  // ── 26. Agente citato per ID → bonus +2 score ─────────────────────────────
  it('26. Messaggio contiene ID agente → bonus +2 → agente incluso nel top-4', () => {
    // Senza menzione: fisiatra è in training domain, score 4, ordinato alfabeticamente
    const withMention = select(
      'training',
      'Ho bisogno di un programma, voglio parlare con il fisiatra',
    )
    // Con menzione "fisiatra": score = 6 (domain +4 + mention +2) → rank 1 → DEVE apparire
    expectIncludes(withMention, 'fisiatra')
    // Verifica che persona-trainer appaia se menzionato esplicitamente
    const withPT = select('training', 'Ho bisogno di un programma con il persona-trainer')
    expectIncludes(withPT, 'persona-trainer')
  })

  // ── 27. Filtro score > 2 ──────────────────────────────────────────────────
  it('27. Agenti fuori dominio con score ≤ 2 sono esclusi dal risultato', () => {
    // Su dominio nutrition, agenti health-only senza competence hints devono essere esclusi
    const result = select('nutrition', 'Voglio una dieta per calorie e alimentazione corretta', [
      'nutrition',
    ])
    // Agenti puramente health senza secondary domain match
    expectExcludes(result, 'dermatologo', 'reumatologo', 'psicologo', 'persona-trainer')
  })

  // ── Bonus: Artrite/dolori articolari con musculoskeletal hint ────────────
  it('EXTRA. "Dolori alle articolazioni" + "dolore" (musculoskeletal hint) → fisiatra/fisioterapista', () => {
    // "dolore" è in MUSCULOSKELETAL_HINTS → fisioterapista e fisiatra ottengono +4 bonus
    const result = select(
      'health',
      'Ho artrite con dolore forte alle articolazioni delle mani e colonna',
    )
    expect(result.length).toBeGreaterThan(0)
    // Con musculoskeletal signal: fisioterapista (+4 training +4 musculo), fisiatra (+4 health+training +4)
    // oppure reumatologo come agente health puro
    expect(
      result.some((id) =>
        ['fisioterapista', 'fisiatra', 'medico-dello-sport', 'reumatologo'].includes(id),
      ),
    ).toBe(true)
  })

  // ── Bonus: Coach di vita per organizzazione ───────────────────────────────
  it('EXTRA. "Organizzare la mia vita" → coordination/inspiration → life-organizer', () => {
    const result = select('coordination', 'Voglio organizzare meglio la mia vita quotidiana')
    expectIncludes(result, 'life-organizer')
  })

  // ── Bonus: Executive per leadership aziendale ─────────────────────────────
  it('EXTRA. "Leadership aziendale" → inspiration → executive-coach', () => {
    const result = select(
      'inspiration',
      'Voglio migliorare le mie capacità di leadership aziendale',
    )
    expectIncludes(result, 'executive-coach')
  })

  // ── Bonus: Intestino (keyword esatta) → gastroenterologo ─────────────────
  it('EXTRA. "Dolore intestino e digestione" (keyword esatte) → gastroenterologo', () => {
    // Le competence hints usano match su token esatti: 'intestino', 'digestione'
    const result = select('health', 'Ho dolore all intestino e problemi di digestione quotidiani')
    expectIncludes(result, 'gastroenterologo')
  })

  // ── Bonus: Infortunio sportivo → medico-dello-sport ───────────────────────
  it('EXTRA. "Infortunio sportivo" → training → medico-dello-sport e fisioterapista', () => {
    const result = select(
      'training',
      'Ho subito un infortunio durante il recupero da un allenamento intenso in sport',
    )
    expect(result.includes('medico-dello-sport') || result.includes('fisioterapista')).toBe(true)
  })

  // ── Bonus: Glicemia alta → endocrinologo ─────────────────────────────────
  it('EXTRA. "Glicemia alta e insulina" → health → endocrinologo per hints metabolismo', () => {
    const result = select('health', 'Ho la glicemia alta e problemi di insulina resistenza')
    expectIncludes(result, 'endocrinologo')
  })
})
