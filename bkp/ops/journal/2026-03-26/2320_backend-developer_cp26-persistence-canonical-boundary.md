2026-03-26 23:20
Ruolo: backend-developer

Prompt (riassunto)
- Implementare solo il refactor stretto di `src/lib/ai/case/persistence.ts`
- Introdurre `readCanonicalCaseRuntimeState()`
- Declassare `fromStoredCaseState()` a facade legacy-safe
- Aggiungere i test minimi in `tests/api/case-persistence.test.ts`

Risultato (riassunto)
- Aggiunto `readCanonicalCaseRuntimeState()` come primary read path canonical-first
- Isolato il parser del `stateSnapshot` persistito
- Isolato il parser legacy del modulo
- `fromStoredCaseState()` ora delega al nuovo boundary canonico e resta adapter temporaneo verso `CaseState`
- Test del modulo estesi a 6 casi minimi, tutti verdi

Evidenze
- `src/lib/ai/case/persistence.ts`
- `tests/api/case-persistence.test.ts`
- `npm run test -- tests/api/case-persistence.test.ts`
- `npm run typecheck`
- `bkp/backups/2026-03-26/2315_persistence-boundary-refactor`

Decisioni
- Non toccati consumer, route, UI, live semantics, Prisma o orchestrator
- Il primo consumer corretto da migrare in seguito resta `src/app/api/chat/send/chatPersistence.ts`

Next
- Nessun passo obbligatorio in questo task
- Eventuale prossimo task: migrazione del primo consumer al nuovo boundary canonico
