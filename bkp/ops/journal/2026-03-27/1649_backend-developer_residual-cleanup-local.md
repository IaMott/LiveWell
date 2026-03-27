Timestamp: 2026-03-27 16:49
Ruolo: backend-developer
Prompt (riassunto): chiudere il residuo realistico senza riaprire il progetto principale, concentrandosi su legacy interno confinato, hardening dei test live e piccoli debt sicuri.

Risultato (riassunto):
- introdotto `toStoredCaseRuntimeState()` in `src/lib/ai/case/persistence.ts`
- `chatPersistence.ts` persiste ora il runtime canonico senza ricostruire `CaseState` nei path snapshot-first
- `chat/send/route.ts` e `chat/live-sync/route.ts` persistono lo snapshot canonico come payload primario quando disponibile
- rafforzati i test live su bootstrap reale osservabile (`stateSnapshot`, attributes, recent history, systemInstruction)
- validazioni locali verdi: test mirati, typecheck, lint, build

Evidenze:
- `src/lib/ai/case/persistence.ts`
- `src/app/api/chat/send/chatPersistence.ts`
- `src/app/api/chat/send/route.ts`
- `src/app/api/chat/live-sync/route.ts`
- `tests/api/chat-send-persistence.test.ts`
- `tests/api/live-sync-stateSnapshot.test.ts`
- `tests/api/live-token-security.test.ts`
- `tests/api/live-token-fallback-observability.test.ts`
- backup locale: `bkp/backups/2026-03-27/1700_residual-cleanup`

Decisioni:
- il legacy interno del protocol engine non viene rimosso in questa track
- il writer snapshot-first e` sufficiente a togliere bridge legacy non necessari dai route principali
- il gap live residuo dopo questo step resta solo di integrazione reale browser/SDK, non di route-level observability

Next:
- commit mirato
- push su `origin/main`
- deploy Vercel production
- verifica alias
- review finale conclusiva dei soli residual recommendations
