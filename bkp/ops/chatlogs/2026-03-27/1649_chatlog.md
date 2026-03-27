Timestamp: 2026-03-27 16:49
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto:
- Pre-flight eseguito su ruolo, STATUS, WORKLOG e DECISIONS.
- Mappato il legacy interno residuo in `chatPersistence`, `chat/send`, `live-sync`, `fastPaths`, `persistence`.
- Mappati i test live ancora troppo mock-heavy su `live-token`.
- Creato backup locale `bkp/backups/2026-03-27/1700_residual-cleanup`.
- Introdotto writer snapshot-first `toStoredCaseRuntimeState()` nel modulo persistence.
- Spostata la persistenza dei route principali su `persistCaseRuntimeState()` quando il canonico esiste gia`.
- Aggiunti guardrail test per:
  - persistenza runtime canonica nel route text
  - persistenza runtime canonica nel route live-sync
  - bootstrap da latest user snapshot senza `conversationId`
  - `systemInstruction` con panel summary, attributi e cronologia recente
- Risolti due assertion test obsolete emersi al primo passaggio.
- Validazioni finali locali verdi:
  - `npm run test -- tests/api/case-persistence.test.ts tests/api/chat-send-persistence.test.ts tests/api/live-sync-stateSnapshot.test.ts tests/api/live-token-security.test.ts tests/api/live-token-fallback-observability.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

Decisioni prese / next:
- non aprire cleanup aggressiva del protocol engine legacy
- procedere ora con commit, push, deploy e review finale
