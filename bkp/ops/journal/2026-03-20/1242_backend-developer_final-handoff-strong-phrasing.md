Timestamp: 2026-03-20 12:42
Ruolo: backend-developer

Prompt (riassunto)

Applicare un solo micro-fix stretto sul residuo same-domain confermato dalla review del commit `f8093cb`: fare aprire `handoff_pending_user` su phrasing forti come `vorrei che fosse lui a seguirmi da ora`, senza rompere takeover morbidi, return baton o le suite di guardia.

Risultato (riassunto)

Modificato solo `src/lib/ai/case/protocol.ts` con pattern aggiuntivi di handoff forte per segnali di ownership stabile. Aggiornato `tests/api/case-protocol.test.ts` con due casi positivi (`vorrei che fosse lui a seguirmi da ora`, `vorrei continuare con lui come riferimento principale`). Verificati anche i casi negativi takeover e return già richiesti. Test mirati verdi (`39/39`), suite di guardia verdi (`24/24`), `typecheck` e `build` verdi.

Evidenze

- `src/lib/ai/case/protocol.ts`
- `tests/api/case-protocol.test.ts`
- `tests/api/runtime-trigger-guards.test.ts`
- `tests/api/domain-detection-critical.test.ts`
- `tests/api/orchestrator-domain-persistence.test.ts`
- `tests/api/orchestrator-synthesis.test.ts`
- `tests/api/artifact-governance.test.ts`

Decisioni

- I phrasing same-domain di ownership stabile devono aprire `handoff_pending_user`.
- I phrasing di continuità conversazionale devono restare takeover.
- Nessun altro modulo è stato toccato.

Next

Commit, push, deploy e nuova validazione mirata post-fix sul team reale.
