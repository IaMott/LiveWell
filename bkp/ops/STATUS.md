Stato progetto

Obiettivo

Chiudere davvero la Fase 1 shared text/live con persistenza canonica di `stateSnapshot`, read path canonical-first, compat layer ridotto a fallback controllato e campagna finale minima di test text/live/reload.

Fatto

- contratto canonico shared text/live introdotto in `src/lib/ai/types.ts`
- state model multi-dominio introdotto in `src/lib/ai/case/state.ts`
- compat layer introdotto in `src/lib/ai/case/compat.ts`
- persistence helpers introdotti in `src/lib/ai/case/persistence.ts`
- transport/runtime text-live allineati su `stateSnapshot`
- reload conversazione, live-sync, cross-conversation e live post-turn riallineati
- `stateSnapshot` ora persistito autonomamente su `CaseState` tramite `state_snapshot` in DB
- `chatPersistence.ts` ora scrive il canonico come primary write path
- `fromStoredCaseState()` ora legge in modalita canonical-first con legacy solo fallback/bridge
- `live-token` ora usa il read path comune invece del mapper legacy manuale
- commit finale pubblicato: `44231c5` (`feat: close phase1 shared text live state`)
- push su `origin/main` completato
- deploy Vercel production completato su `https://livewell.mottisi.com`
- verifica HTTP positiva dell'alias production
- copertura aggiunta:
  - `tests/api/case-persistence.test.ts`
  - `tests/api/conversation-stateSnapshot-route.test.ts`
  - `tests/api/live-sync-stateSnapshot.test.ts`
- fix prestazionali minimi gia` applicati:
  - recovery client su primo `chat/send` in `ChatContext.tsx`
  - eliminazione del doppio timeout round1+round2 in `agentRoundExecution.ts`
- migrazioni DB rilevanti allineate:
  - risolte incoerenze storiche Prisma su `20260316_message_reviews` e `20260318224000_add_case_states`
  - applicata `20260326205200_add_case_state_snapshot`
- validazioni finali verdi:
  - `npx prisma generate`
  - `npm run typecheck`
  - `npm run test -- tests/api/conversation-stateSnapshot-route.test.ts tests/api/live-sync-stateSnapshot.test.ts tests/api/case-persistence.test.ts tests/api/chat-send-persistence.test.ts tests/api/domain-canonical-write-read.e2e.test.ts tests/api/live-token-fallback-observability.test.ts tests/api/live-token-security.test.ts tests/conversations-api.test.ts`
- fix locale dei failure CI piu recenti:
  - `tests/api/conversation-thinking-export.test.ts` ora mocka `prisma.caseState.findUnique`
  - `tests/api/orchestrator-interview-flow.test.ts` e` riallineato ai peer stub proposals persistiti dal flow
  - validazione verde con test mirati + `npm run typecheck`

In corso

Nessun blocco applicativo aperto nel perimetro minimo Fase 1 shared text/live; in attesa solo della nuova esecuzione CI remota sul commit correttivo.

Prossimo

- push del fix test-only e verifica del nuovo workflow GitHub Actions su `main`
- follow-up solo se richiesto: ulteriore riduzione/rimozione del compat layer in fase successiva

Rischi

- resta legacy temporaneo controllato: `ownerAgentId`, `activeSpeakerAgentId`, `protocolState` e i mapper di compatibilita` sopravvivono per dati storici e fallback
- resta rischio non bloccante: il bootstrap/test live reale con microfono/browser non e` verificabile dal terminale; la chiusura Fase 1 e` supportata da route tests, integration tests e smoke HTTP locali
- resta rischio non bloccante: agenti lenti possono ancora andare in timeout al `Round 1`, ma non pagano piu` il doppio timeout al `Round 2`
- resta debito dichiarato per fase successiva: rimozione del compat layer residuo quando non serviranno piu` dati legacy

Ultimo aggiornamento

2026-03-26 22:55
