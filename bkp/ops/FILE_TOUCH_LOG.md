File touch log (append-only)

2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/chat/userVisibleContent.ts` | action=completed | contract=canonical | note=`nuovo filtro condiviso dei contenuti assistant visibili per eliminare syntax interna e payload backend`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/transcript/route.ts` | action=completed | contract=canonical | note=`transcript live reso sequential write, metadata-aware e con sanitizzazione assistant`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatInput.tsx` | action=completed | contract=canonical | note=`queue locale per serializzare i save live e sync assistant post-live-sync con speaker metadata`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=completed | contract=canonical | note=`appendLiveMessage esteso con domain/specialistName e fallback specialistName corretto lato SSE`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatShell.tsx` | action=completed | contract=canonical | note=`banner specialista riallineato allo speaker dell'ultimo messaggio assistant`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=completed | contract=canonical | note=`speaker label assistant resa coerente con activeSpecialist prima del lead-panel stale`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/conversations/[id]/route.ts` | action=completed | contract=canonical | note=`load conversazione sanificato contro payload assistant interni`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/conversations/[id]/export/route.ts` | action=completed | contract=canonical | note=`export conversazione sanificato contro payload assistant interni`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/conversations/route.ts` | action=completed | contract=canonical | note=`preview lista conversazioni sanificato contro payload assistant interni`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-transcript-route.test.ts` | action=completed | contract=test | note=`copertura su ordering persistito, metadata assistant e drop dei payload-only assistant`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/chat-input-live-ordering.test.tsx` | action=completed | contract=test | note=`guardrail client sulla serializzazione del transcript live user->assistant`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/chat-shell-specialist-banner.test.tsx` | action=completed | contract=test | note=`guardrail UI sul banner specialista rispetto all'ultimo speaker assistant`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/conversation-thinking-export.test.ts` | action=completed | contract=test | note=`copertura su load/export sanificati dei payload assistant interni`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-send-persistence.test.ts` | action=completed | contract=test | note=`guardrail sulla label specialistName assistant quando il lead panel e` stale`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint locale validato`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/FILE_TOUCH_LOG.md` | action=completed | contract=temporary | note=`ledger aggiornato per il fix pack prioritario`
2026-03-27 20:43 | step=CP-50 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`rischi aggiornati sul fix pack post-feedback`

2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/conversation-stateSnapshot-route.test.ts` | action=completed | contract=canonical | note=`copertura del reload conversazione con stateSnapshot persistito`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/live-sync-stateSnapshot.test.ts` | action=completed | contract=canonical | note=`copertura della response live-sync con stateSnapshot canonical-first`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`stato finale Fase 1 aggiornato a chiusura effettiva`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append chiusura finale Fase 1`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR finale di chiusura Fase 1`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint finale validato`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/FILE_TOUCH_LOG.md` | action=completed | contract=temporary | note=`append ledger finale`
2026-03-26 21:17 | step=CP-23 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`chiusura rischi Fase 1 e registrazione residui non bloccanti`

2026-03-26 20:56 | step=CP-22 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/persistence.ts` | action=completed | contract=canonical | note=`read path reso canonical-first con stateSnapshot prioritario`
2026-03-26 20:56 | step=CP-22 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/case-persistence.test.ts` | action=completed | contract=canonical | note=`copertura unitaria del primary path canonico e del fallback legacy`

2026-03-26 20:53 | step=CP-21 | file=`/Users/mattiamottisi/Desktop/LiveWell/prisma/schema.prisma` | action=completed | contract=canonical | note=`aggiunto campo Json stateSnapshot/state_snapshot al model CaseState`
2026-03-26 20:53 | step=CP-21 | file=`/Users/mattiamottisi/Desktop/LiveWell/prisma/migrations/20260326205200_add_case_state_snapshot/migration.sql` | action=completed | contract=canonical | note=`migrazione minima per persistenza autonoma del canonico`
2026-03-26 20:53 | step=CP-21 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/chatPersistence.ts` | action=completed | contract=canonical | note=`attivato dual-write reale di stateSnapshot nel payload caseState.upsert`
2026-03-26 20:53 | step=CP-21 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/live-token/route.ts` | action=completed | contract=canonical | note=`read path spostato da row legacy manuale a fromStoredCaseState canonical-first`

2026-03-26 15:58 | step=CP-0 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/types.ts` | action=planned | contract=canonical | note=`target unico applicativo consentito per STEP-1`
2026-03-26 15:58 | step=CP-0 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo Fase 1`
2026-03-26 15:58 | step=CP-0 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog esecuzione checkpoint`
2026-03-26 15:58 | step=CP-0 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su STEP-1 additivo`
2026-03-26 15:58 | step=STEP-1 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/types.ts` | action=completed | contract=canonical | note=`introdotti CanonicalCaseStateSnapshot, DomainPanel, SpeakerPolicy e campi opzionali additive`
2026-03-26 15:58 | step=STEP-1 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`registro checkpoint creato`
2026-03-26 15:58 | step=STEP-1 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/FILE_TOUCH_LOG.md` | action=completed | contract=temporary | note=`ledger append-only creato`
2026-03-26 15:58 | step=STEP-1 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`risk log iniziale creato`
2026-03-26 16:02 | step=CP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/state.ts` | action=planned | contract=canonical | note=`target unico applicativo consentito per STEP-2`
2026-03-26 16:02 | step=STEP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/state.ts` | action=completed | contract=canonical | note=`estesi i campi opzionali canonici e la normalizzazione duale legacy+nuovo`
2026-03-26 16:02 | step=STEP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-2`
2026-03-26 16:02 | step=STEP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-2`
2026-03-26 16:02 | step=STEP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-2`
2026-03-26 16:02 | step=STEP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su normalizzazione duale`
2026-03-26 16:02 | step=STEP-2 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio su fallback legacy sintetici`
2026-03-26 16:05 | step=CP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/compat.ts` | action=planned | contract=canonical | note=`target unico applicativo consentito per STEP-3`
2026-03-26 16:05 | step=STEP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/compat.ts` | action=completed | contract=canonical | note=`centralizzati mapper legacy->canonico e canonico->fallback legacy`
2026-03-26 16:05 | step=STEP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-3`
2026-03-26 16:05 | step=STEP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-3`
2026-03-26 16:05 | step=STEP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-3`
2026-03-26 16:05 | step=STEP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su compat layer centrale`
2026-03-26 16:05 | step=STEP-3 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio su helper canonici non ancora persistiti`
2026-03-26 16:08 | step=CP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/persistence.ts` | action=planned | contract=canonical | note=`target unico applicativo consentito per STEP-4`
2026-03-26 16:08 | step=STEP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/persistence.ts` | action=completed | contract=canonical | note=`introdotti helper dual-read e future dual-write mantenendo toStoredCaseState legacy-safe`
2026-03-26 16:08 | step=STEP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-4`
2026-03-26 16:08 | step=STEP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-4`
2026-03-26 16:08 | step=STEP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-4`
2026-03-26 16:08 | step=STEP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su persistence dual-shape`
2026-03-26 16:08 | step=STEP-4 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio su dual-write non ancora attivato`
2026-03-26 16:19 | step=CP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/chatPersistence.ts` | action=planned | contract=canonical | note=`primo consumer server comune del layer persistence`
2026-03-26 16:19 | step=STEP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/chatPersistence.ts` | action=completed | contract=canonical | note=`adottati dual-read e future dual-write in modo backward-compatible`
2026-03-26 16:19 | step=STEP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-5`
2026-03-26 16:19 | step=STEP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-5`
2026-03-26 16:19 | step=STEP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-5`
2026-03-26 16:19 | step=STEP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su adozione del primo consumer`
2026-03-26 16:19 | step=STEP-5 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sul nuovo contratto ancora invisibile ai client`
2026-03-26 16:22 | step=CP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=planned | contract=canonical | note=`primo punto di propagazione esterna del nuovo snapshot canonico`
2026-03-26 16:22 | step=STEP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=completed | contract=canonical | note=`stateSnapshot aggiunto al payload SSE ui.state in modo additivo`
2026-03-26 16:22 | step=STEP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-6`
2026-03-26 16:22 | step=STEP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-6`
2026-03-26 16:22 | step=STEP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-6`
2026-03-26 16:22 | step=STEP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su payload SSE esteso`
2026-03-26 16:22 | step=STEP-6 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sul nuovo snapshot non ancora consumato da client/live`
2026-03-26 16:39 | step=CP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/live-sync/route.ts` | action=planned | contract=canonical | note=`allineamento del ramo live al nuovo snapshot server-side`
2026-03-26 16:39 | step=STEP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/live-sync/route.ts` | action=completed | contract=canonical | note=`stateSnapshot adottato come input, fallback operativo e output JSON`
2026-03-26 16:39 | step=STEP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-7`
2026-03-26 16:39 | step=STEP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-7`
2026-03-26 16:39 | step=STEP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-7`
2026-03-26 16:39 | step=STEP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su allineamento live-sync`
2026-03-26 16:39 | step=STEP-7 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sul client ancora non allineato`
2026-03-26 16:48 | step=CP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=planned | contract=canonical | note=`primo consumer client del nuovo snapshot condiviso`
2026-03-26 16:48 | step=STEP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=completed | contract=canonical | note=`stateSnapshot letto dagli SSE/loadConversation e conservato in memoria/localStorage`
2026-03-26 16:48 | step=STEP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-8`
2026-03-26 16:48 | step=STEP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-8`
2026-03-26 16:48 | step=STEP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-8`
2026-03-26 16:48 | step=STEP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su conservazione client del nuovo snapshot`
2026-03-26 16:48 | step=STEP-8 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sul fatto che i consumer visuali non usano ancora il nuovo snapshot`
2026-03-26 16:52 | step=CP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatShell.tsx` | action=planned | contract=canonical | note=`primo consumer visuale del nuovo snapshot condiviso`
2026-03-26 16:52 | step=STEP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatShell.tsx` | action=completed | contract=canonical | note=`stateSnapshot usato come fallback visuale per dominio lead e specialista lead senza rimuovere i campi legacy`
2026-03-26 16:52 | step=STEP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-9`
2026-03-26 16:52 | step=STEP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-9`
2026-03-26 16:52 | step=STEP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-9`
2026-03-26 16:52 | step=STEP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su fallback visuale in ChatShell`
2026-03-26 16:52 | step=STEP-9 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sulla divergenza residua tra ChatShell e live-token`
2026-03-26 17:02 | step=CP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/live-token/route.ts` | action=planned | contract=canonical | note=`bootstrap live allineato al nuovo snapshot condiviso`
2026-03-26 17:02 | step=STEP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/live-token/route.ts` | action=completed | contract=canonical | note=`stateSnapshot derivato dal CaseState legacy e usato come fallback prioritario per lead panel, systemInstruction e payload JSON`
2026-03-26 17:02 | step=STEP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-10`
2026-03-26 17:02 | step=STEP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-10`
2026-03-26 17:02 | step=STEP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-10`
2026-03-26 17:02 | step=STEP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su bootstrap live panel-aware`
2026-03-26 17:02 | step=STEP-10 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sul consumer live che non usa ancora il nuovo snapshot`
2026-03-26 17:21 | step=CP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/live/LiveModal.tsx` | action=planned | contract=canonical | note=`primo consumer live client del nuovo snapshot condiviso`
2026-03-26 17:21 | step=STEP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/live/LiveModal.tsx` | action=completed | contract=canonical | note=`stateSnapshot letto dal bootstrap di live-token, conservato lato client e usato in modo additivo per rinforzare il contesto live`
2026-03-26 17:21 | step=STEP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-11`
2026-03-26 17:21 | step=STEP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-11`
2026-03-26 17:21 | step=STEP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-11`
2026-03-26 17:21 | step=STEP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su consumer live client`
2026-03-26 17:21 | step=STEP-11 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio sullo stato live ora condiviso ma ancora con fallback legacy prioritari`
2026-03-26 17:40 | step=CP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/conversations/[id]/route.ts` | action=planned | contract=canonical | note=`primo blocco minimo per restituire stateSnapshot reale nel reload server-side`
2026-03-26 17:40 | step=STEP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/conversations/[id]/route.ts` | action=completed | contract=canonical | note=`stateSnapshot ricostruito dal CaseState legacy corrente e restituito nel payload di reload in modo additivo`
2026-03-26 17:40 | step=STEP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-12`
2026-03-26 17:40 | step=STEP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-12`
2026-03-26 17:40 | step=STEP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-12`
2026-03-26 17:40 | step=STEP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul reload server-side con stateSnapshot`
2026-03-26 17:40 | step=STEP-12 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio residuo sui fallback globali cross-conversation`
2026-03-26 17:42 | step=CP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=planned | contract=canonical | note=`secondo blocco minimo per eliminare i fallback globali cross-conversation`
2026-03-26 17:42 | step=STEP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=completed | contract=canonical | note=`stateSnapshot e stato specialistico spostati su chiavi localStorage scoped per conversationId e reset corretti in loadConversation`
2026-03-26 17:42 | step=STEP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-13`
2026-03-26 17:42 | step=STEP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-13`
2026-03-26 17:42 | step=STEP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-13`
2026-03-26 17:42 | step=STEP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su localStorage scoped per conversazione`
2026-03-26 17:42 | step=STEP-13 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio residuo sul solo post-turn live al client`
2026-03-26 17:46 | step=CP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/live/LiveModal.tsx` | action=planned | contract=canonical | note=`terzo blocco minimo per ridurre il gap post-turn live sul client`
2026-03-26 17:46 | step=STEP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/live/LiveModal.tsx` | action=completed | contract=canonical | note=`refresh server-side della conversazione corrente dopo il turno assistant per aggiornare subito stateSnapshot senza doppiare live-sync`
2026-03-26 17:46 | step=STEP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-14`
2026-03-26 17:46 | step=STEP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo STEP-14`
2026-03-26 17:46 | step=STEP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog STEP-14`
2026-03-26 17:46 | step=STEP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul refresh live post-turn via route conversazione`
2026-03-26 17:46 | step=STEP-14 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio residuo sul fatto che la response di live-sync non e ancora consumata direttamente`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/conversation-thinking-export.test.ts` | action=completed | contract=test | note=`aggiunto prisma.caseState.findUnique al mock per coprire il reload conversazione aggiornato`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/orchestrator-interview-flow.test.ts` | action=completed | contract=test | note=`riallineata l'aspettativa di round2ForPersistence ai peer stub proposals oggi persistiti dal flow`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-24`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo fix CI test-only`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog fix CI test-only`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su regressione mock Prisma e failure preesistente del test interview flow`
2026-03-26 22:55 | step=CP-24 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`registrato rischio CI mitigato sul drift dei test rispetto al runtime attuale`
2026-03-26 23:07 | step=CP-25 | file=`/Users/mattiamottisi/Desktop/LiveWell/.github/workflows/ci.yml` | action=completed | contract=infra | note=`bump minimo delle GitHub Actions da v4 a v5 per eliminare il warning di deprecazione Node 20 sulle action runtime`
2026-03-26 23:07 | step=CP-25 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-25`
2026-03-26 23:07 | step=CP-25 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo fix workflow CI`
2026-03-26 23:07 | step=CP-25 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog fix workflow CI`
2026-03-26 23:07 | step=CP-25 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul bump minimo a GitHub Actions v5`
2026-03-26 23:07 | step=CP-25 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornato rischio CI residuo sulle action runtime deprecate`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/persistence.ts` | action=completed | contract=canonical | note=`introdotto readCanonicalCaseRuntimeState(), isolati parser canonico e legacy, fromStoredCaseState() ridotta a facade legacy-safe`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/case-persistence.test.ts` | action=completed | contract=test | note=`coperti i casi minimi su canonical reader, precedence dello snapshot, fallback legacy e facade legacy-safe`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-26`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo refactor persistence boundary`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog refactor persistence boundary`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul nuovo primary read path canonical-first`
2026-03-26 23:20 | step=CP-26 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`registrati i rischi residui di facade legacy e migrazione consumer non ancora iniziata`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/chatPersistence.ts` | action=completed | contract=canonical | note=`RoutePersistenceDeps esteso con getCaseRuntimeState/persistCaseRuntimeState; persistCaseState riallineato a canonical-first senza rompere i caller legacy`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-send-persistence.test.ts` | action=completed | contract=test | note=`aggiunti test mirati sul nuovo read/write path canonico esposto da createDbPersistenceDeps`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-27`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo migrazione del primo consumer canonical-first`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog migrazione chatPersistence al boundary canonico`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sull'estensione canonical-first di RoutePersistenceDeps`
2026-03-26 23:35 | step=CP-27 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`registrati i rischi residui sul prossimo route migration step`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=completed | contract=canonical | note=`il route text legge ora getCaseRuntimeState() come primary path, passa caseStateSnapshot all'orchestrator e usa persistCaseRuntimeState() solo come fallback quando manca nextCaseState`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-send-persistence.test.ts` | action=completed | contract=test | note=`aggiunto test sul passaggio di caseStateSnapshot all'orchestrator e isolato il mock orchestrator per non contaminare le suite successive`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-28`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo migrazione del route text al boundary canonico`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog migrazione chat/send/route.ts`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul route text canonical-first con fallback legacy locale`
2026-03-26 23:38 | step=CP-28 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornati i rischi residui verso live-token/live-sync e compat layer`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/live-token/route.ts` | action=completed | contract=canonical | note=`bootstrap live spostato sul read boundary canonico con risoluzione activeAgentId dal lead panel senza dipendere direttamente dalla facade legacy`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/live-token-fallback-observability.test.ts` | action=completed | contract=test | note=`aggiunto test sul bootstrap live canonical-first con snapshot persistito e mock Prisma caseState esplicito`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-29`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo migrazione live-token`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog migrazione live-token`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul bootstrap live canonical-first`
2026-03-26 23:40 | step=CP-29 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornati i rischi residui sul reload conversazione e su live-sync`
2026-03-26 23:42 | step=CP-30 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/conversations/[id]/route.ts` | action=completed | contract=canonical | note=`reload conversazione spostato sul read boundary canonico esplicito senza passare dalla facade legacy`
2026-03-26 23:42 | step=CP-30 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-30`
2026-03-26 23:42 | step=CP-30 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo migrazione route conversazioni`
2026-03-26 23:42 | step=CP-30 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog migrazione conversations/[id]/route.ts`
2026-03-26 23:42 | step=CP-30 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul reload conversazione canonical-first`
2026-03-26 23:42 | step=CP-30 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`aggiornati i rischi residui concentrandoli su live-sync e semantica tool live`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/live-sync/route.ts` | action=completed | contract=canonical | note=`live-sync migrato al boundary canonico e tool execution resa panel-aware per-call invece che mono-agent globale`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/live-sync-stateSnapshot.test.ts` | action=completed | contract=test | note=`aggiunto test sulla selezione per-call dell'agent tool dal panel/domain context`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-31`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato operativo dopo migrazione live-sync`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog migrazione live-sync`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su live-sync canonical-first e tool context per-call`
2026-03-26 23:45 | step=CP-31 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`rischi residui spostati sui contratti ibridi e sul compat layer`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=completed | contract=canonical | note=`ui.state snapshot-first con compat fields derivati dal lead panel canonico`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=completed | contract=canonical | note=`stateSnapshot esposto dal context, sincronizzato via storage e usato come fonte primaria per dominio/specialista`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatShell.tsx` | action=completed | contract=canonical | note=`banner/input visuali derivati dal canonico prima dei fallback legacy`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/types.ts` | action=completed | contract=canonical | note=`documentato il ruolo primario del caseStateSnapshot e quello compat del caseState`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/orchestrator/orchestrator.ts` | action=completed | contract=canonical | note=`il protocol input usa ora lo snapshot canonico come base prioritaria nei conflitti col legacy`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/orchestrator/fastPaths.ts` | action=completed | contract=canonical | note=`fast path età usa il panel canonico prima del legacy compatibility speaker`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-send-persistence.test.ts` | action=completed | contract=test | note=`coperto il contract ui.state derivato dal lead panel canonico`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-orchestration.test.ts` | action=completed | contract=test | note=`coperto l'uso del caseStateSnapshot come base canonica quando il legacy e` in conflitto`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/multi-agent-execution.test.ts` | action=completed | contract=test | note=`coperto il fast path che privilegia il panel canonico sul legacy speaker`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-32`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato architetturale dopo cleanup snapshot-first finale`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog chiusura architetturale post-Fase-1`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul bordo text/live snapshot-first`
2026-03-26 23:55 | step=CP-32 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`mitigati i rischi sui contratti ibridi; restano solo residui legacy non bloccanti`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx` | action=completed | contract=canonical | note=`rimosso activeSpecialistId dal request body text; il client invia solo il payload canonico necessario`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/chatStream.ts` | action=completed | contract=canonical | note=`tipizzato ui.state.stateSnapshot nel contract SSE condiviso`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=completed | contract=canonical | note=`emissione ui.state resa coerente con il serializer toSse() mantenendo snapshot-first`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/orchestrator/routingLegacy.ts` | action=deleted | contract=legacy | note=`dead code legacy non piu` referenziata nel runtime o nei test`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-33`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato finale dopo cleanup non bloccante e review critica`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog cleanup track finale`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul cleanup finale guidato da evidenze forti`
2026-03-27 00:32 | step=CP-33 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`registrati i residui legacy accettati e i warning infrastrutturali futuri`
2026-03-27 08:16 | step=CP-34 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-34 con publish remoto e verifica alias`
2026-03-27 08:16 | step=CP-34 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornato stato finale dopo push/deploy production`
2026-03-27 08:16 | step=CP-34 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog publish finale`
2026-03-27 08:16 | step=CP-34 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul verdict finale done-with-residual-recommendations`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/package.json` | action=completed | contract=infra | note=`bump sicuro di next/eslint/eslint-config-next e overrides mirati per ridurre advisory runtime/dev patchabili`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/package-lock.json` | action=completed | contract=infra | note=`lockfile riallineato a upgrade patch e overrides infra/security`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/next.config.ts` | action=completed | contract=infra | note=`aggiunto turbopack.root per eliminare il warning workspace root multipli`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/proxy.ts` | action=completed | contract=infra | note=`migrazione middleware -> proxy per Next 16`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/middleware.ts` | action=deleted | contract=infra | note=`rimosso file deprecato dopo migrazione a proxy.ts`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-35`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`aggiornamento stato track infra/security locale`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog triage/fix infra-security`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR su fix low-risk e residui audit accettati`
2026-03-27 10:35 | step=CP-35 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`classificati warning Next risolti e residue advisory dev-toolchain`
2026-03-27 10:40 | ruolo=backend-developer | file=package.json | azione=modify | motivo=major toolchain upgrade mirato `lint-staged@16` + `vitest@4` e override `picomatch`
2026-03-27 10:40 | ruolo=backend-developer | file=package-lock.json | azione=modify | motivo=lockfile riallineato dopo `npm install` della nuova baseline toolchain
2026-03-27 10:52 | ruolo=backend-developer | file=tests/api/live-token-security.test.ts | azione=modify | motivo=stabilizzazione compatibilita` `vitest@4` con mock lazy import + prisma mock
2026-03-27 10:52 | ruolo=backend-developer | file=tests/api/live-token-fallback-observability.test.ts | azione=modify | motivo=allineamento mock constructor-style per compatibilita` `vitest@4`
2026-03-27 11:24 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione publish finale della track toolchain
2026-03-27 11:24 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=allineamento stato progetto dopo commit/push/deploy della track toolchain
2026-03-27 11:24 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append del publish finale e verifica alias production
2026-03-27 11:24 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione verdict finale della track toolchain
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=append checkpoint CP-40 per review avversariale completa
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=registrazione esito review ostile post-closeout
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=ADR che nega il verdetto implicito di progetto pulito
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/RISK_LOG.md | azione=modify | motivo=classificazione dei rischi reali emersi dalla review totale
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/STATUS.md | azione=modify | motivo=aggiornamento stato progetto dopo review avversariale
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/journal/2026-03-27/1208_code-reviewer_adversarial-project-review.md | azione=create | motivo=storico resumable della review completa
2026-03-27 12:08 | ruolo=code-reviewer | file=bkp/ops/chatlogs/2026-03-27/1208_chatlog.md | azione=create | motivo=chatlog sintetico della review avversariale
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/tools/toolExecutionRouting.ts` | action=created | contract=canonical | note=`helper condiviso per la selezione agent tool per-call/panel-aware usato da text e live`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts` | action=completed | contract=canonical | note=`tool execution text riallineata al resolver condiviso per-call; route non ricostruisce piu` `CaseState` se esiste `stateSnapshot``
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/live-sync/route.ts` | action=completed | contract=canonical | note=`live-sync usa il resolver condiviso e non ricostruisce il legacy nel path caldo quando il runtime canonico esiste`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/persistence.ts` | action=completed | contract=canonical | note=`boundary canonico fail-closed su snapshot malformed; nessun fallback legacy silenzioso se lo snapshot esiste ma e` invalido`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatShell.tsx` | action=completed | contract=canonical | note=`rimossa la narrativa single-agent dal commento live per evitare contraddizioni semantiche`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/case-persistence.test.ts` | action=completed | contract=test | note=`aggiunti test negativi per snapshot malformed senza downgrade al legacy`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-send-persistence.test.ts` | action=completed | contract=test | note=`aggiunto test che dimostra il routing tool text per-call su agenti diversi in base al panel/domain`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-42`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`stato aggiornato dopo la chiusura locale delle track correttive obbligatorie`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog sulle correzioni post-review avversariale`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul fix minimo corretto per tool semantics e boundary canonico`
2026-03-27 12:53 | step=CP-42 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/RISK_LOG.md` | action=completed | contract=temporary | note=`mitigati i risk item CP-40/41 e ridotto il residuo legacy del path caldo`
2026-03-27 12:59 | step=CP-43 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/CHECKPOINTS.md` | action=completed | contract=temporary | note=`append checkpoint CP-43 con publish remoto e verifica alias`
2026-03-27 12:59 | step=CP-43 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/STATUS.md` | action=completed | contract=temporary | note=`stato finale aggiornato dopo push/deploy delle track correttive`
2026-03-27 12:59 | step=CP-43 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/WORKLOG.md` | action=completed | contract=temporary | note=`append worklog publish finale post-review avversariale`
2026-03-27 12:59 | step=CP-43 | file=`/Users/mattiamottisi/Desktop/LiveWell/bkp/ops/DECISIONS.md` | action=completed | contract=temporary | note=`append ADR sul verdict finale done-with-residual-recommendations post-fix obbligatori`
2026-03-27 13:10 | ruolo=backend-developer | file=src/lib/dynamicDb/semantics.ts | azione=modify | motivo=riconciliazione blocco A: `birthDate` riportato a dato statico canonico, distinto dai dati derivati nel tempo
2026-03-27 13:10 | ruolo=backend-developer | file=src/app/api/profile/dynamic-db/route.ts | azione=modify | motivo=riconciliazione blocco B: `currentAge` derivato anche dagli attributi personali storicizzati quando `UserProfile.birthDate` manca
2026-03-27 13:10 | ruolo=backend-developer | file=src/lib/tools/handlers.ts | azione=modify | motivo=riconciliazione blocco B: note agentiche rese obbligatorie sui principali write-path Dynamic DB
2026-03-27 13:10 | ruolo=backend-developer | file=tests/api/profile-dynamic-db-route.test.ts | azione=modify | motivo=copertura su semantica statica di `birthDate` e derivazione di `currentAge` dagli attributi
2026-03-27 13:10 | ruolo=backend-developer | file=tests/api/cartella-clinica.test.ts | azione=modify | motivo=copertura sull'obbligatorieta` delle note agentiche nei tool clinici
2026-03-27 13:10 | ruolo=backend-developer | file=tests/api/dynamic-db-agent-notes.test.ts | azione=create | motivo=guardrail sui tool Dynamic DB che devono salvare note non vuote
2026-03-27 15:26 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-44/CP-45 della riconciliazione storica
2026-03-27 15:26 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=allineamento stato progetto dopo la riconciliazione storica e il publish dei fix A/B
2026-03-27 15:26 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append della riconciliazione storica con gap A/B chiusi e blocco D ancora parziale
2026-03-27 15:26 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione ADR sui fix Dynamic DB e sul residuo keyword-heavy del routing
2026-03-27 15:26 | ruolo=backend-developer | file=bkp/ops/RISK_LOG.md | azione=modify | motivo=registrazione del rischio residuo obbligatorio sul routing multi-dominio ancora euristico
2026-03-27 16:16 | ruolo=backend-developer | file=src/lib/ai/orchestrator/contextualRouting.ts | azione=create | motivo=introdotto resolver contestuale che usa LLM, snapshot e history prima del fallback euristico keyword-based
2026-03-27 16:16 | ruolo=backend-developer | file=src/lib/ai/orchestrator/orchestrator.ts | azione=modify | motivo=il cuore del routing ora usa il resolver context-first e passa preferredAgentIds ordinati al ranking dei candidati
2026-03-27 16:16 | ruolo=backend-developer | file=src/lib/ai/orchestrator/routing.ts | azione=modify | motivo=resolveRoutingCandidates supporta preferredAgentIds come segnale primario del panel contestuale
2026-03-27 16:16 | ruolo=backend-developer | file=src/lib/ai/orchestrator/agentSelection.ts | azione=modify | motivo=AGENT_COMPETENCE_HINTS ridotti a booster; preferredAgentIds ordinati diventano il segnale piu forte del ranking
2026-03-27 16:16 | ruolo=backend-developer | file=src/lib/ai/orchestrator/decisionTrace.ts | azione=modify | motivo=decision trace esteso a llm_context, snapshot_context e history_context
2026-03-27 16:16 | ruolo=backend-developer | file=src/lib/ai/case/protocol.ts | azione=modify | motivo=il protocol preserva lo speaker/panel corrente nei follow-up contestuali invece di aprire consult takeover guidati dal legacy/euristiche
2026-03-27 16:16 | ruolo=backend-developer | file=tests/api/multi-agent-routing.test.ts | azione=modify | motivo=guardrail sul ranking context-first e sui preferredAgentIds
2026-03-27 16:16 | ruolo=backend-developer | file=tests/api/orchestrator-routing-phase1.test.ts | azione=modify | motivo=prova del ranking primario guidato dai preferredAgentIds nel path production resolveRoutingCandidates
2026-03-27 16:16 | ruolo=backend-developer | file=tests/api/chat-orchestration.test.ts | azione=modify | motivo=prova end-to-end del source llm_context e della continuita snapshot-first nel path orchestrate
2026-03-27 16:16 | ruolo=backend-developer | file=src/components/profile/UserAvatar.tsx | azione=modify | motivo=chiuso warning lint residuo sostituendo img con next/image
2026-03-27 16:16 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-46 del routing context-first validato localmente
2026-03-27 16:16 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=allineamento stato progetto dopo la chiusura locale della track obbligatoria residua
2026-03-27 16:16 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append della chiusura locale del routing multi-dominio context-first
2026-03-27 16:16 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=ADR sulla retrocessione delle euristiche a fallback/supporto nel routing
2026-03-27 16:16 | ruolo=backend-developer | file=bkp/ops/RISK_LOG.md | azione=modify | motivo=mitigazione del rischio high sul routing keyword-heavy e chiusura del warning lint residuo
2026-03-27 16:22 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-47 con publish remoto e verifica alias
2026-03-27 16:22 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=allineamento stato progetto dopo commit/push/deploy della track context-first
2026-03-27 16:22 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append del publish remoto della track obbligatoria residua
2026-03-27 16:22 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione del verdict finale dopo la chiusura e pubblicazione della track context-first
2026-03-27 16:49 | ruolo=backend-developer | file=src/lib/ai/case/persistence.ts | azione=modify | motivo=introdotto writer snapshot-first per confinare la ricostruzione legacy ai soli casi necessari
2026-03-27 16:49 | ruolo=backend-developer | file=src/app/api/chat/send/chatPersistence.ts | azione=modify | motivo=RoutePersistenceDeps persiste ora il runtime canonico direttamente senza ricostruire `CaseState` per il path normale
2026-03-27 16:49 | ruolo=backend-developer | file=src/app/api/chat/send/route.ts | azione=modify | motivo=il route text persiste lo snapshot canonico come primary payload quando il consenso lo espone o lo rende derivabile
2026-03-27 16:49 | ruolo=backend-developer | file=src/app/api/chat/live-sync/route.ts | azione=modify | motivo=live-sync persiste il runtime canonico senza ricostruire legacy nel path snapshot-first
2026-03-27 16:49 | ruolo=backend-developer | file=tests/api/chat-send-persistence.test.ts | azione=modify | motivo=guardrail sul writer snapshot-first del route text
2026-03-27 16:49 | ruolo=backend-developer | file=tests/api/live-sync-stateSnapshot.test.ts | azione=modify | motivo=guardrail sul writer snapshot-first del route live-sync
2026-03-27 16:49 | ruolo=backend-developer | file=tests/api/live-token-security.test.ts | azione=modify | motivo=copertura sul bootstrap da latest user snapshot quando conversationId manca
2026-03-27 16:49 | ruolo=backend-developer | file=tests/api/live-token-fallback-observability.test.ts | azione=modify | motivo=verifica del contenuto reale di systemInstruction su snapshot canonico, attributi e cronologia
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-48 del cleanup residuo locale validato
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=aggiornamento stato progetto dopo il cleanup residuo locale
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append del cleanup residuo locale su legacy interno e test live
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=ADR sul confinamento del legacy writer e sul livello massimo ragionevole di hardening live in questa track
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/RISK_LOG.md | azione=modify | motivo=mitigazione del residuo legacy hot-path e riduzione del gap live mock-heavy
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/journal/2026-03-27/1649_backend-developer_residual-cleanup-local.md | azione=create | motivo=storico resumable del cleanup residuo locale
2026-03-27 16:49 | ruolo=backend-developer | file=bkp/ops/chatlogs/2026-03-27/1649_chatlog.md | azione=create | motivo=chatlog sintetico del cleanup residuo locale
2026-03-27 16:57 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-49 con publish remoto e verifica alias del cleanup residuo
2026-03-27 16:57 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=stato finale allineato dopo push/deploy del cleanup residuo
2026-03-27 16:57 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append del publish remoto del cleanup residuo
2026-03-27 16:57 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione del verdict finale `DONE WITH RESIDUAL RECOMMENDATIONS`
2026-03-27 16:57 | ruolo=backend-developer | file=bkp/ops/journal/2026-03-27/1657_backend-developer_residual-cleanup-publish.md | azione=create | motivo=storico resumable del publish finale del cleanup residuo
2026-03-27 16:57 | ruolo=backend-developer | file=bkp/ops/chatlogs/2026-03-27/1657_chatlog.md | azione=create | motivo=chatlog sintetico del publish finale del cleanup residuo
2026-03-27 20:43 | ruolo=backend-developer | file=src/lib/chat/userVisibleContent.ts | azione=create | motivo=introdotto sanitizer condiviso per rimuovere payload/tool interni dai contenuti assistant visibili
2026-03-27 20:43 | ruolo=backend-developer | file=src/app/api/chat/transcript/route.ts | azione=modify | motivo=transcript live ordinato e metadata-aware; assistant sanitizzato e persistenza resa sequenziale per preservare l'ordine
2026-03-27 20:43 | ruolo=backend-developer | file=src/components/chat/ChatInput.tsx | azione=modify | motivo=serializzazione client delle write transcript live e sync live prima della persistenza assistant
2026-03-27 20:43 | ruolo=backend-developer | file=src/contexts/ChatContext.tsx | azione=modify | motivo=appendLiveMessage ora conserva domain e specialistName dell'assistant dopo sanitizzazione
2026-03-27 20:43 | ruolo=backend-developer | file=src/components/chat/ChatShell.tsx | azione=modify | motivo=il banner specialista segue l'ultimo messaggio assistant con speaker reale invece del lead panel stale
2026-03-27 20:43 | ruolo=backend-developer | file=src/app/api/chat/send/route.ts | azione=modify | motivo=il messaggio assistant usa la label dello speaker corrente e il contenuto visibile viene sanitizzato prima di stream/persist
2026-03-27 20:43 | ruolo=backend-developer | file=src/app/api/conversations/[id]/route.ts | azione=modify | motivo=load conversazione sanitizza i contenuti assistant e scarta righe interne vuote
2026-03-27 20:43 | ruolo=backend-developer | file=src/app/api/conversations/[id]/export/route.ts | azione=modify | motivo=export txt filtra payload/tool interni e usa solo contenuti assistant realmente visibili
2026-03-27 20:43 | ruolo=backend-developer | file=src/app/api/conversations/route.ts | azione=modify | motivo=lista conversazioni usa preview assistant sanitizzata
2026-03-27 20:43 | ruolo=backend-developer | file=tests/api/chat-transcript-route.test.ts | azione=create | motivo=guardrail su ordering transcript live, sanitizzazione assistant e metadata specialist/domain
2026-03-27 20:43 | ruolo=backend-developer | file=tests/chat-input-live-ordering.test.tsx | azione=create | motivo=verifica serializzazione client dei turni live e ordering user->assistant con sync live intermedio
2026-03-27 20:43 | ruolo=backend-developer | file=tests/chat-shell-specialist-banner.test.tsx | azione=create | motivo=guardrail sul banner che deve seguire lo speaker reale dell'ultimo messaggio assistant
2026-03-27 20:43 | ruolo=backend-developer | file=tests/api/conversation-thinking-export.test.ts | azione=modify | motivo=prova che load/export eliminano righe leaked `Payload:` dai messaggi assistant
2026-03-27 20:43 | ruolo=backend-developer | file=tests/api/chat-send-persistence.test.ts | azione=modify | motivo=guardrail sulla label speaker corrente quando il lead panel e` indietro rispetto al messaggio assistant
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint locale CP-50 del fix pack post-feedback
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=stato progetto aggiornato dopo validazione locale del fix pack prioritario
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append della validazione locale del fix pack prioritario
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=ADR sul trattamento del fix come boundary runtime e non come polish UI
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/RISK_LOG.md | azione=modify | motivo=registrazione dei rischi mitigati su ordering, leakage payload e mismatch speaker/banner
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/journal/2026-03-27/2043_backend-developer_feedback-fix-pack.md | azione=create | motivo=storico resumable del fix pack prioritario post-feedback
2026-03-27 20:43 | ruolo=backend-developer | file=bkp/ops/chatlogs/2026-03-27/2043_chatlog.md | azione=create | motivo=chatlog sintetico del fix pack prioritario post-feedback
2026-03-27 20:49 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-51 con publish remoto e verifica alias del fix pack prioritario
2026-03-27 20:49 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=stato finale allineato dopo push/deploy del fix pack prioritario
2026-03-27 20:49 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append del publish remoto del fix pack prioritario
2026-03-27 20:49 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione della decisione runtime-first sul fix pack emerso dal feedback reale
2026-03-27 21:40 | ruolo=qa-expert | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-52 della verifica production del fix pack
2026-03-27 21:40 | ruolo=qa-expert | file=bkp/ops/STATUS.md | azione=modify | motivo=stato progetto riallineato al verdetto QA production sui tre cluster
2026-03-27 21:40 | ruolo=qa-expert | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append della verifica production con utente smoke reale
2026-03-27 21:40 | ruolo=qa-expert | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione del verdetto PARTIAL sul cluster filtering dopo verifica production
2026-03-27 20:54 | ruolo=backend-developer | file=src/lib/chat/userVisibleContent.ts | azione=modify | motivo=il sanitizer assistant ora rimuove anche payload strutturati inline in forma JSON o key:value legacy, preservando il testo visibile residuo
2026-03-27 20:54 | ruolo=backend-developer | file=tests/api/chat-transcript-route.test.ts | azione=modify | motivo=guardrail sul caso production-like con payload inline e testo assistant sulla stessa riga
2026-03-27 20:54 | ruolo=backend-developer | file=tests/api/conversation-thinking-export.test.ts | azione=modify | motivo=guardrail load/export sul caso stored content misto payload inline + testo visibile
2026-03-27 20:54 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-53 della chiusura del cluster filtering
2026-03-27 20:54 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=stato progetto riallineato dopo chiusura e verifica production del follow-up filtering
2026-03-27 20:54 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append del fix finale sul transcript filtering misto
2026-03-27 20:54 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=ADR sullo stripping del payload strutturato inline senza perdita del testo user-visible
2026-03-27 21:56 | ruolo=qa-expert | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-54 della rerun QA production post-fix
2026-03-27 21:56 | ruolo=qa-expert | file=bkp/ops/STATUS.md | azione=modify | motivo=stato progetto riallineato alla verifica production finale del fix pack
2026-03-27 21:56 | ruolo=qa-expert | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append della rerun QA production con esito finale PASS sui quattro controlli
2026-03-27 21:56 | ruolo=qa-expert | file=bkp/ops/DECISIONS.md | azione=modify | motivo=cristallizzazione della chiusura QA production del fix pack transcript/output/speaker
2026-03-27 22:20 | ruolo=backend-developer | file=tests/api/live-modal-bootstrap.test.ts | azione=create | motivo=guardrail browser-facing sul boundary `LiveModal -> /api/live-token -> GoogleGenAI.live.connect`, con fallback snapshot client-side e persistenza dello snapshot server
2026-03-27 22:20 | ruolo=backend-developer | file=tests/api/contextual-routing.test.ts | azione=create | motivo=guardrail puro sui source di continuity `snapshot_context` e `history_context` per evitare regressioni verso il fallback euristico
2026-03-27 22:20 | ruolo=backend-developer | file=bkp/ops/CHECKPOINTS.md | azione=modify | motivo=registrazione checkpoint CP-55 della track separata live/browser meno mock-heavy
2026-03-27 22:20 | ruolo=backend-developer | file=bkp/ops/FILE_TOUCH_LOG.md | azione=modify | motivo=append dei file toccati nella track separata live/browser
2026-03-27 22:20 | ruolo=backend-developer | file=bkp/ops/RISK_LOG.md | azione=modify | motivo=aggiornamento dei rischi live residui dopo l'aggiunta dei nuovi guardrail
2026-03-27 22:20 | ruolo=backend-developer | file=bkp/ops/STATUS.md | azione=modify | motivo=stato progetto aggiornato dopo la chiusura della track separata live/browser
2026-03-27 22:20 | ruolo=backend-developer | file=bkp/ops/WORKLOG.md | azione=modify | motivo=append della chiusura della track separata live/browser
2026-03-27 22:20 | ruolo=backend-developer | file=bkp/ops/DECISIONS.md | azione=modify | motivo=ADR sulla scelta di rafforzare il perimetro live solo con guardrail ad alto ROI
