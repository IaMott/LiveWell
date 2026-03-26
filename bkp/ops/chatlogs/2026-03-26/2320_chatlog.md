2026-03-26 23:20
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto
- Focus ristretto a `src/lib/ai/case/persistence.ts` e `tests/api/case-persistence.test.ts`.
- Nessun consumer o route toccato.
- Introdotto il nuovo boundary `readCanonicalCaseRuntimeState()`.
- Separati il parse del `stateSnapshot` e il parse legacy.
- `fromStoredCaseState()` ora e` solo facade legacy-safe che delega al boundary canonico.
- Aggiunti i test minimi richiesti per canonical-first, fallback legacy e contratto della facade.
- Test modulo verdi.
- `typecheck` verde.

Decisioni prese / next step
- Decisione: mantenere `fromStoredCaseState()` compatibile per non rompere i consumer.
- Decisione: non modificare `types.ts`, `compat.ts` o `state.ts` per questo step.
- Next: il primo consumer corretto da migrare e` `src/app/api/chat/send/chatPersistence.ts`.

Prompt chiave (riassunti)
- "implementa solo il refactor stretto di persistence.ts"
- "non migrare consumer"
- "aggiungere i test minimi del modulo"
