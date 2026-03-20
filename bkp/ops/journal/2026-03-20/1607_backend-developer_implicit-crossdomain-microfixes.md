Timestamp: 2026-03-20 16:07
Ruolo: backend-developer

Prompt (riassunto)
- Applicare micro-fix reali e localizzati ai residui confermati dalla campagna sistemica finale sul baseline `1a2101d`.
- Perimetro: monodominio implicito cross-domain, consulti impliciti residui, dirty cases ad alta entropia.
- Vincoli: niente UI, niente refactor generale, niente modifiche a `CaseState`, niente riapertura di queue/gating/artifacts/SSE.

Risultato (riassunto)
- Rafforzata la detection implicita in `src/lib/ai/domain/domainDetection.ts` con nuovi pattern semantici su nutrizione, training, health endocrino/sport pain, burnout/focus, inspiration pratica e coordination.
- Rafforzata la scelta dell'owner implicito in `src/lib/ai/case/protocol.ts` per specialisti health/training/inspiration/coordination, riducendo fallback deboli.
- Rafforzato il ranking dei consulti impliciti in `src/lib/ai/capabilities/registry.ts` per training pain, executive burnout, coordination overload, family/legal e reason semantiche.
- Test aggiornati:
  - `tests/api/domain-detection-critical.test.ts`
  - `tests/api/runtime-trigger-guards.test.ts`
  - `tests/api/case-protocol.test.ts`
- Verifiche eseguite:
  - `npm run test -- tests/api/domain-detection-critical.test.ts tests/api/runtime-trigger-guards.test.ts tests/api/case-protocol.test.ts`
  - `npm run test -- tests/api/orchestrator-domain-persistence.test.ts tests/api/orchestrator-synthesis.test.ts tests/api/artifact-governance.test.ts`
  - `npm run typecheck`
  - `npm run build`

Evidenze
- `src/lib/ai/domain/domainDetection.ts`
- `src/lib/ai/case/protocol.ts`
- `src/lib/ai/capabilities/registry.ts`
- `tests/api/domain-detection-critical.test.ts`
- `tests/api/runtime-trigger-guards.test.ts`
- `tests/api/case-protocol.test.ts`

Decisioni
- Confermato uso dei tre layer canonici già individuati dalla campagna finale, senza espandere il perimetro ad altri moduli runtime.
- Confermata la necessità di una nuova validazione mirata post-fix prima di dichiarare chiuso il cluster implicito cross-domain.

Next
- Commit, push e deploy del diff applicativo.
- Poi nuova review mirata sui cluster impliciti/dirties corretti.
