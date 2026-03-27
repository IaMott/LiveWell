Stato progetto

Obiettivo

Chiudere l'architettura shared text/live sul target canonical-first: un solo runtime canonico multi-dominio, live/text come adapter dello stesso stato, compat legacy confinato e nessuna seconda architettura concorrente.

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
- fix workflow CI sul warning Node 20 deprecation:
  - `.github/workflows/ci.yml` usa ora `actions/checkout@v5`
  - `.github/workflows/ci.yml` usa ora `actions/setup-node@v5`
  - validazione minima verde su YAML/formatting locale
- refactor stretto del boundary canonical-first in `src/lib/ai/case/persistence.ts`:
  - introdotto `readCanonicalCaseRuntimeState()` come primary read path del modulo
  - `fromStoredCaseState()` declassata a facade legacy-safe
  - `tests/api/case-persistence.test.ts` esteso ai 6 casi minimi richiesti
  - validazione verde con test del modulo + `npm run typecheck`
- primo consumer canonical-first migrato in `src/app/api/chat/send/chatPersistence.ts`:
  - `RoutePersistenceDeps` espone ora `getCaseRuntimeState()` e `persistCaseRuntimeState()`
  - `persistCaseState()` resta compatibile ma converge sul write path canonico quando possibile
  - `tests/api/chat-send-persistence.test.ts` copre read/write canonico nel deps layer
  - validazione verde con `npm run test -- tests/api/chat-send-persistence.test.ts tests/api/case-persistence.test.ts` e `npm run typecheck`
- `src/app/api/chat/send/route.ts` migrato al boundary canonico:
  - usa `getCaseRuntimeState()` come primary read path
  - passa `caseStateSnapshot` all'orchestrator
  - usa `persistCaseState()` quando esiste `nextCaseState` e `persistCaseRuntimeState()` solo come fallback runtime
  - test mirati verdi su route text + persistence
- `src/app/api/live-token/route.ts` migrato al boundary canonico:
  - bootstrap live legge ora `readCanonicalCaseRuntimeState()` come source of truth
  - `activeAgentId` viene risolto dal lead panel canonico
  - test mirato verde sul bootstrap con snapshot persistito
- `src/app/api/conversations/[id]/route.ts` migrato al boundary canonico:
  - reload conversazione legge ora direttamente `readCanonicalCaseRuntimeState()`
  - il payload esterno resta invariato ma il source of truth non passa piu` dalla facade legacy
- `src/app/api/chat/live-sync/route.ts` migrato al boundary canonico:
  - usa `getCaseRuntimeState()` come primary read path
  - persiste in canonical-first anche nel ramo live
  - seleziona l'agente tool per-call dal panel/domain context invece di usare un solo `capabilityAgentId` globale
- cleanup snapshot-first del bordo text/live completato:
  - `src/app/api/chat/send/route.ts` emette ora `ui.state` con `domain`, `activeSpecialistId`, `specialistName` derivati dal lead panel canonico quando disponibile
  - `src/contexts/ChatContext.tsx` espone `stateSnapshot` nel context e lo usa come fonte primaria per dominio/specialista
  - `src/components/chat/ChatShell.tsx` deriva ora lo stato visuale dal canonico prima dei fallback legacy
- cleanup minimo del core orchestration completato:
  - `src/lib/ai/orchestrator/orchestrator.ts` usa `caseStateSnapshot` come base prioritaria quando il legacy e` in conflitto
  - `src/lib/ai/orchestrator/fastPaths.ts` usa il panel canonico come source of truth per il compatibility speaker
- copertura finale estesa aggiunta:
  - `tests/api/chat-orchestration.test.ts`
  - `tests/api/multi-agent-execution.test.ts`
  - aggiornato `tests/api/chat-send-persistence.test.ts`
- validazioni finali estese verdi:
  - `npm run typecheck`
  - `npm run build`
  - `npm run test -- tests/api/chat-orchestration.test.ts tests/api/multi-agent-execution.test.ts tests/api/chat-send-persistence.test.ts tests/api/live-sync-stateSnapshot.test.ts tests/api/live-token-fallback-observability.test.ts tests/api/conversation-stateSnapshot-route.test.ts tests/api/case-persistence.test.ts`
  - `npm run test -- tests/api/chat-send-security.test.ts tests/api/live-token-security.test.ts tests/api/domain-canonical-write-read.e2e.test.ts`
- fix pack prioritario post-feedback reale implementato:
  - transcript live serializzato e reso metadata-aware in `src/app/api/chat/transcript/route.ts` e `src/components/chat/ChatInput.tsx`
  - payload/tool interni filtrati dai contenuti assistant visibili via `src/lib/chat/userVisibleContent.ts`
  - banner specialista riallineato allo speaker reale dell'ultimo messaggio assistant in `src/components/chat/ChatShell.tsx`
  - `chat/send` usa ora la label dello speaker corrente prima del lead panel per il messaggio assistant
  - aggiunti test mirati su transcript route, ordering live client, banner specialista e sanitizzazione export/load
- validazioni locali del fix pack verdi:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test -- tests/api/chat-transcript-route.test.ts tests/api/conversation-thinking-export.test.ts tests/api/chat-send-persistence.test.ts tests/chat-input-live-ordering.test.tsx tests/chat-shell-specialist-banner.test.tsx`
  - `npm run test -- tests/chat-input-live-ordering.test.tsx tests/chat-shell-specialist-banner.test.tsx tests/api/chat-transcript-route.test.ts`

In corso

- verifica QA production del fix pack transcript/output/speaker completata
- emerso un residuo nel filtering transcript assistant misto payload+testo visibile da correggere in un follow-up stretto

Prossimo

- aprire un fix mirato sul sanitizer/transcript route per preservare il testo assistant visibile quando il messaggio contiene anche una riga `Payload:`
- dopo il fix, ripetere la stessa verifica production sul transcript misto

Rischi

- resta legacy interno confinato ma non bloccante: `CaseState`, `fromStoredCaseState()` e `compatibilitySpeakerId` sopravvivono nell'engine/protocol per record storici e adapter interni, non piu` nei route hot-path di persistenza canonical-first
- resta rischio non bloccante sul live reale: i test ora verificano piu` contenuto osservabile del bootstrap (`stateSnapshot`, history, attributes, systemInstruction), ma una integrazione browser/SDK non mockata non e` eseguibile dal terminale
- rischio applicativo mitigato ma da monitorare in production: transcript live e speaker metadata dipendono ora da serializzazione client + sync live; se il close della sessione avviene in una finestra molto stretta resta possibile un gap non osservato dai test locali
- rischio QA emerso in production: il leak di `Payload:` e` chiuso, ma un assistant transcript con riga interna + testo visibile puo` essere scartato interamente invece di preservare la parte user-visible
- restano solo debiti separati e fuori track:
  - advisory moderate dev-only sullo stack lint/toolchain
  - eventuale major Prisma
  - cleanup interno piu` profondo del protocol engine legacy solo se il ROI giustifica una nuova track

Ultimo aggiornamento

2026-03-27 21:40
