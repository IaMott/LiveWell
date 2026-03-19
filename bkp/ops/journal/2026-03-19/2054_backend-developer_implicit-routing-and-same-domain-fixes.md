Timestamp

2026-03-19 20:54

Ruolo

backend-developer

Prompt (riassunto)

Applicare micro-fix mirati sui residui confermati dopo la validazione avanzata: monodominio implicito cross-domain, consulti impliciti `legal/dermatologia/cardiologia/gastro` e same-domain takeover/handoff naturale.

Risultato (riassunto)

- Rafforzato `domainDetection.ts` su segnali impliciti nutrition, health, legal, gastro, dermatologia e coordination.
- Rafforzato `protocol.ts` su scelta owner implicito e continuita same-domain.
- Rafforzato `registry.ts` su ranking consult target impliciti e handoff same-domain con forte affinità semantica.
- Aggiornati test mirati per owner implicito, consulti impliciti e handoff same-domain.
- Verifiche finali verdi: 36/36 test mirati, 28/28 suite adiacenti, `typecheck`, `build`.

Evidenze

- `src/lib/ai/domain/domainDetection.ts`
- `src/lib/ai/capabilities/registry.ts`
- `src/lib/ai/case/protocol.ts`
- `tests/api/domain-detection-critical.test.ts`
- `tests/api/runtime-trigger-guards.test.ts`
- `tests/api/case-protocol.test.ts`

Decisioni

- Nessun refactor strutturale.
- Nessun cambio UI.
- Nessun cambio a `CaseState`.
- Nessun spostamento di logica nei prompt.

Next

Commit, push, deploy e nuova validazione mirata post-fix.
