File touch log (append-only)

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
