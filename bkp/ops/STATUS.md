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

In corso

- nessun blocco implementativo obbligatorio aperto

Prossimo

- eventuali follow-up non bloccanti:
  - rimuovere il `middleware` deprecato o impostare `proxy` quando il warning Next entrera` nel perimetro
  - ridurre il fallback storico `CaseState` solo se emergera` evidenza che nessun record legacy lo richiede piu`

Rischi

- resta legacy temporaneo controllato: `ownerAgentId`, `activeSpeakerAgentId`, `protocolState` e i mapper di compatibilita` sopravvivono per dati storici e fallback
- resta rischio non bloccante: il bootstrap/test live reale con microfono/browser non e` verificabile dal terminale; la chiusura Fase 1 e` supportata da route tests, integration tests e smoke HTTP locali
- resta rischio non bloccante: agenti lenti possono ancora andare in timeout al `Round 1`, ma non pagano piu` il doppio timeout al `Round 2`
- resta debito dichiarato per fase successiva: rimozione del compat layer residuo quando non serviranno piu` dati legacy
- resta compat legacy residuo non bloccante: `CaseState` sopravvive come adapter interno per continuity del protocol e per record storici senza snapshot
- restano warning non bloccanti di build/runtime:
  - warning Next su workspace root multipli
  - deprecazione convenzione `middleware` -> `proxy`
- resta compatibility locale non bloccante: `activeDomain`, `activeSpecialistId` e `specialistName` sopravvivono solo come derived fields/client fallback
- resta rischio non bloccante: il live browser reale con microfono/camera non e` verificabile dal terminale, ma bootstrap/post-turn/tool semantics sono coperti da test di route e integrazione
- track infra/security completata:
  - `next` ed `eslint-config-next` aggiornati a `16.2.1`
  - `eslint` aggiornato a `9.39.4`
  - `src/middleware.ts` migrato a `src/proxy.ts`
  - `next.config.ts` ora definisce `turbopack.root`
  - overrides mirati applicati a `gaxios`, `google-auth-library`, `flatted`, `yaml`
  - audit ridotto da `17` vulnerabilita` (`15 moderate`, `2 high`) a `10` (`9 moderate`, `1 high`)
- residui infra/security ora limitati a:
  - advisory dev-toolchain su `picomatch` via `lint-staged`/`vitest` e su `minimatch` via stack `eslint`
  - update Prisma major disponibile ma fuori perimetro della track
  - warning deprecati Vercel/npm di terze parti senza impatto runtime diretto

Ultimo aggiornamento

2026-03-27 10:35
