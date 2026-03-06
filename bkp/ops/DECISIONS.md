## ADR-010: PR operativa su branch rebased

- **Date**: 2026-03-04 15:26
- **Decision**: usare come branch sorgente PR verso .
- **Rationale**: branch precedente aveva storia non allineata con e causava problemi operativi.

## ADR-011: Correzione record PR

- **Date**: 2026-03-04 15:26
- **Decision**: confermato che la PR operativa è la #1 da feat/orchestration-profile-live-redesign-v2 a main.
- **Rationale**: riallineare il tracciamento memoria senza errori di escaping shell.

## ADR-012: Blocco output JSON in chat utente

- **Date**: 2026-03-04 15:41
- **Decision**: intercettare output strutturati e normalizzarli in linguaggio naturale prima della consegna UI.
- **Rationale**: allineamento UX con requirement di conversazione umana continua.

## ADR-013: Coesistenza professionisti con panel esplicito

- **Date**: 2026-03-04 15:48
- **Decision**: quando coinvolti più specialisti, generare contributi separati per ciascuno nello stesso turno (no cambio-cappello implicito).
- **Rationale**: allineare UX al modello "co-working" richiesto dall’utente.

## ADR-014: Stato/memoria separata per professionista (per conversazione)

- **Date**: 2026-03-04 15:53
- **Decision**: memorizzare memoria specialistica in .
- **Rationale**: mantenere continuità di contesto per singolo professionista senza dipendere da cambio-cappello.

## ADR-015: Turnazione esplicita multi-agent in streaming

- **Date**: 2026-03-04 15:53
- **Decision**: introdurre eventi SSE per agente (, , ) e persistere messaggi assistant separati per autore.
- **Rationale**: rappresentare coesistenza professionisti in modo trasparente e testabile in UI.

## ADR-014: Stato/memoria separata per professionista (per conversazione)

- **Date**: 2026-03-04 15:54
- **Decision**: memorizzare memoria specialistica in settings.aiSpecialistMemory[conversationId][specialistId].
- **Rationale**: mantenere continuità di contesto per singolo professionista senza dipendere da cambio-cappello.

## ADR-015: Turnazione esplicita multi-agent in streaming

- **Date**: 2026-03-04 15:54
- **Decision**: introdurre eventi SSE per agente (agent_turn, agent_delta, agent_done) e persistere messaggi assistant separati per autore.
- **Rationale**: rappresentare coesistenza professionisti in modo trasparente e testabile in UI.

## ADR-016: Routing hard-priority su richiesta professionista esplicita

- **Date**: 2026-03-04 16:17
- **Decision**: se l’utente richiede esplicitamente un professionista, `routeMessage` forza direttamente quello specialista come primario e salta il gating da intervistatore.
- **Rationale**: eliminare interruzioni/fake-handoff e rendere il passaggio di testimone effettivo nel turno successivo.

## ADR-017: Handoff contestuale automatico multi-professionista

- **Date**: 2026-03-04 16:21
- **Decision**: il passaggio di testimone non dipende solo da richiesta esplicita; il routing usa dominio+knownData per attivare automaticamente uno o piu professionisti.
- **Rationale**: garantire coesistenza reale dei professionisti quando il contesto lo richiede, evitando risposte monolitiche dell'analista.

## ADR-018: Esclusione ruoli di coordinamento dal parlato operativo

- **Date**: 2026-03-04 16:30
- **Decision**: `analista_contesto` non e piu fallback operativo in chat utente; `intervistatore` non viene usato come support voice del turn.
- **Rationale**: evitare loop narrativi di handoff e garantire turni solo di professionisti esecutivi.

## ADR-019: Anti-stall su output handoff

- **Date**: 2026-03-04 16:30
- **Decision**: se output modello contiene segnali di handoff e resta non operativo, sostituire con domanda concreta guidata dal professionista corrente.
- **Rationale**: impedire interruzioni conversazionali e mantenere progressione reale del dialogo.

## ADR-020: Gestione storico chat utente con reset esplicito

- **Date**: 2026-03-04 16:42
- **Decision**: introdotto `DELETE /api/conversations` (bulk e singola via query) + azioni UI `Nuova chat` e `Elimina storico`.
- **Rationale**: dare controllo esplicito all'utente su reset sessione e cancellazione storico per ripartenza pulita.

## ADR-021: Delete singola conversazione via route dedicata

- **Date**: 2026-03-04 16:47
- **Decision**: introdotto `DELETE /api/conversations/[id]` con risposta 404 se non trovata.
- **Rationale**: separare chiaramente la cancellazione puntuale dalla bulk delete, semplificando UI e test.

## ADR-022: Validazione strict di conversationId su delete bulk route

- **Date**: 2026-03-04 16:55
- **Decision**: se `conversationId` e presente ma vuoto/blank, endpoint risponde 400 e non esegue delete.
- **Rationale**: prevenire regressione ad alto impatto con cancellazione totale involontaria dello storico.

## ADR-023: Lock UI anti-concorrenza per operazioni delete nello storico

- **Date**: 2026-03-04 17:21
- **Decision**: durante delete bulk o single, i pulsanti di delete restano disabilitati fino a completamento operazione.
- **Rationale**: evitare race condition UI e doppie richieste concorrenti che possono produrre stato inconsistente.

## ADR-024: Guard re-entrancy esplicita su delete bulk storico

- **Date**: 2026-03-04 18:46
- **Decision**: `handleDeleteAll` blocca esecuzione se `isDeleting` e gia true.
- **Rationale**: chiudere completamente la finestra di race su invocazioni concorrenti del bulk delete.

## ADR-025: Merge PR #1 eseguito via git locale per indisponibilita GitHub API in sessione

- **Date**: 2026-03-04 19:14
- **Decision**: eseguito merge equivalente PR #1 con `git merge` su main e push diretto su origin/main.
- **Rationale**: `gh` non raggiungeva `api.github.com`; merge richiesto comunque completato con workflow git affidabile.

## ADR-026: Chiusura formale STEP 9 e avvio STEP 10 con backlog strutturato

- **Date**: 2026-03-04 19:32
- **Decision**: STEP 9 dichiarato completato; STEP 10 avviato con backlog prioritario in `bkp/ops/STEP10_BACKLOG.md`.
- **Rationale**: consolidare i risultati post-merge e avviare sviluppo modulare del profilo con ordine esecutivo e dipendenze chiare.

## ADR-027: Schema profilo canonico centralizzato + validatori condivisi

- **Date**: 2026-03-04 20:17
- **Decision**: introdotto `src/lib/profile/schema.ts` come singola fonte di verita per sezioni profilo (`personal/health/nutrition/training/mindfulness/goals/settings`) con parse/normalize riusabile da API e sync AI.
- **Rationale**: eliminare divergenze tra UI/API/sync, ridurre sanitizzazioni duplicate e prevenire payload incoerenti.

## ADR-028: Idempotenza obbligatoria sync chat->profilo

- **Date**: 2026-03-04 20:17
- **Decision**: aggiunto `syncId` per turno chat (deterministico in chat route), ledger `settings.aiSyncLedger` e deduplica su history di sezione, audit, attachment catalog e memoria specialisti.
- **Rationale**: evitare duplicazioni dovute a retry/riinvio stream mantenendo coerenza storica e audit trail affidabile.

## ADR-029: Profile settings update deve preservare metadati AI interni

- **Date**: 2026-03-04 20:22
- **Decision**: nelle update utente di `section=settings`, effettuare merge sul record esistente mantenendo chiavi tecniche (`aiAuditLog`, `aiSyncLedger`, `aiSpecialistMemory`, `attachmentHistory`, ecc.) e validando solo i campi user-facing.
- **Rationale**: evitare perdita storico/audit/memoria specialisti durante salvataggi UI impostazioni.

## ADR-030: Safe-normalization profilo in lettura per compatibilita legacy

- **Date**: 2026-03-04 20:29
- **Decision**: GET `/api/profile` usa parse safe con fallback a default sezione in caso di JSON legacy non conforme.
- **Rationale**: evitare errori 500 e garantire continuita UX anche con dati storici eterogenei.

## ADR-031: Stabilizzazione test runner Vitest per API/UI mix

- **Date**: 2026-03-04 20:29
- **Decision**: default test env `node`, mapping `jsdom` solo per `*.test.tsx`, `pool: forks`, `maxWorkers:1`, timeout espliciti.
- **Rationale**: ridurre rischio deadlock/hang nei test backend con dipendenze Next/Prisma e mantenere affidabili i test UI.

## ADR-032: Settings API deve bloccare override metadati AI da input utente

- **Date**: 2026-03-04 20:37
- **Decision**: in `PUT /api/profile` (section `settings`) consentire merge solo su chiavi user-facing (`notifications`, `theme`, `language`) ignorando/rigettando chiavi tecniche `ai*`, `attachmentHistory` e simili.
- **Rationale**: prevenire corruzione/azzeramento audit e memoria specialisti tramite payload non trusted.

## ADR-033: Allowlist obbligatoria per `settings` user-facing

- **Date**: 2026-03-04 21:03
- **Decision**: in `PUT /api/profile` con `section=settings` si aggiornano solo `notifications`, `theme`, `language`; eventuali chiavi extra dal payload vengono ignorate.
- **Rationale**: prevenire override/corruzione di metadati AI interni (`ai*`, `attachmentHistory`, ledger) tramite input non trusted.

## ADR-034: Readiness merge Sprint 10.1 condizionata da esito CI

- **Date**: 2026-03-04 21:25
- **Decision**: i fix finali su settings sono approvati in review; merge consentito solo dopo conferma test verdi su CI/runner esterno.
- **Rationale**: in sessione locale il runner Vitest resta appeso senza output, quindi manca evidenza runtime affidabile.

## ADR-035: Sprint 10.1 chiuso con merge PR #2 su main

- **Date**: 2026-03-04 21:58
- **Decision**: completato merge di `feat/step10-sprint10-1-finalize` su `main` dopo check CI verdi e deploy Vercel completato.
- **Rationale**: tutti i blocker Sprint 10.1 (settings allowlist, anti-override metadati, fallback legacy, dedup allegati) risultano chiusi e validati in pipeline remota.

## ADR-036: Endpoint storico profilo per sezione

- **Date**: 2026-03-05 11:22
- **Decision**: introdotto `GET /api/profile/history` con query `section` e `limit`, output `timeline + sectionHistory + attachmentsBySection`.
- **Rationale**: rendere interrogabile lo storico profilo lato UI/API con filtro per dominio/sezione.

## ADR-037: Indicizzazione allegati per sezione in profile sync

- **Date**: 2026-03-05 11:22
- **Decision**: `syncProfileFromConversation` salva allegati con campo `section` e mantiene `settings.attachmentBySection[section]` con deduplica per chiave composta.
- **Rationale**: collegare allegati chat/live al contesto profilo corretto e facilitarne il rendering nello storico di sezione.

## ADR-038: UX storico profilo/chat con stati uniformi

- **Date**: 2026-03-05 11:22
- **Decision**: `HistoryPageContent` unifica feedback `loading/success/error` e integra timeline profilo filtrabile per sezione.
- **Rationale**: coerenza UX tra sezioni profilo e maggiore trasparenza delle modifiche automatiche AI.

## ADR-039: Chiusura Sprint 10.2 con merge PR #3

- **Date**: 2026-03-05 12:11
- **Decision**: PR #3 (`feat/step10-sprint10-2-profile-history`) unita su `main`; baseline aggiornata al commit `b176a7934ed3f5cd345b43b1aa5c8b551f5f1f16`.
- **Rationale**: endpoint storico profilo, mapping allegati per sezione e UX stati uniformi risultano validati dai check CI e pronti come base per Sprint 10.3.

## ADR-040: Apertura Sprint 10.3 con piano operativo API/UI/Test

- **Date**: 2026-03-05 12:43
- **Decision**: Sprint 10.3 avviato su quattro stream: completezza MVD per sezione, export storico profilo, hardening UX/a11y mobile e refactor tecnico leggero con test regressivi.
- **Rationale**: chiudere STEP 10 su production-readiness dei moduli profilo mantenendo tracciabilita, robustezza API e coerenza UX.

## ADR-041: Nuovo endpoint completezza profilo UI-ready

- **Date**: 2026-03-05 12:51
- **Decision**: introdotto `GET /api/profile/completeness` con output minimale per UI (`section`, `completion`, `missingFields`, `nextField`) e supporto filtro `section`.
- **Rationale**: abilitare indicatori di completezza MVD per sezione nel profilo con contratto API stabile e riusabile.

## ADR-042: Completezza profilo esposta centralmente da `useProfile`

- **Date**: 2026-03-05 12:59
- **Decision**: `useProfile` ora gestisce anche fetch/stati completezza (`completeness`, `completenessLoading`, `completenessError`) e fornisce `getSectionCompleteness` per consumo uniforme UI.
- **Rationale**: evitare logica duplicata tra nav e pagine sezione, mantenendo feedback consistente loading/error su tutto il modulo profilo.

## ADR-043: Sprint 10.3 Task 2 non merge-ready senza stato completezza condiviso

- **Date**: 2026-03-05 13:36
- **Decision**: bloccare readiness merge finche `ProfileNav` e pagine sezione non leggono lo stesso stato completezza (single source of truth) o refresh coordinato.
- **Rationale**: con istanze separate di `useProfile`, i badge nav possono restare stantii dopo `saveSection`, causando incoerenza UX e regressione funzionale.

## ADR-044: Stato completezza condiviso con provider profilo

- **Date**: 2026-03-05 13:43
- **Decision**: introdotto `ProfileStateProvider` in `ProfileShell`; `ProfileNav` e pagine sezione consumano `useProfileState` (stessa istanza `useProfile`).
- **Rationale**: eliminare drift di stato tra componenti fratelli e garantire aggiornamento badge nav immediato dopo salvataggi sezione.

## ADR-045: Sprint 10.3 Task 2 merge-ready dopo fix stato condiviso

- **Date**: 2026-03-05 13:47
- **Decision**: chiuso il blocker Task 2; approvata merge-readiness del pacchetto completezza UI (provider condiviso + test integrazione post-save).
- **Rationale**: review finale senza finding bloccanti e conferma test mirati (`profile-completeness-api`, `profile-nav-completeness`, `profile-section-completeness`, `profile-completeness-shared-state`) tutti passati.

## ADR-046: Step 1 security baseline limitato allo scope approvato

- Date: 2026-03-06 00:28
- Decision: implementare solo hardening iniziale (no secret leakage, chat/send security baseline, env validation, test dedicati) senza correggere debito storico fuori scope.
- Rationale: rispettare vincolo utente su Step 1 e mantenere cambi minimi/coerenti prima della fase tool engine completa.

## ADR-047: Segregazione suite legacy per stabilizzazione baseline CI

- Date: 2026-03-06 00:31
- Decision: restringere `vitest` alle suite attuali allineate al tree (`tests/smoke`, `tests/api`, `tests/security`) ed escludere backup e file duplicati `* 2.*`.
- Rationale: evitare falsi negativi da test legacy che referenziano file non presenti nella baseline corrente; garantire un gate CI affidabile durante il refactor incrementale.

## ADR-048: Tool Execution Engine baseline server-side con policy di sicurezza esplicite

- Date: 2026-03-06 00:35
- Decision: introdurre layer tools dedicato con registro allowlist, schema validation zod, RBAC per ruolo, audit obbligatorio su mutazioni e guard prompt-injection per contenuti file/web su tool distruttivi.
- Rationale: applicare invarianti PROJECT_BIBLE e preparare il passaggio successivo alla persistenza ConfirmAction.

## ADR-049 — Step 2 tool execution baseline completato

- Data: 2026-03-06 00:36
- Stato: Accepted
- Contesto: serviva baseline server-side sicura per esecuzione tool in chat/orchestrator.
- Decisione: mantenere registry allowlist centralizzato con schema Zod per tool, RBAC esplicito per ruolo e audit obbligatorio su tutte le mutazioni; bloccare tool distruttivi da input non trusted (upload/web-link/web-content).
- Impatto: ridotto rischio di esecuzione non autorizzata e prompt-injection verso azioni distruttive; pronto il passaggio a persistenza confirmToken DB nel prossimo step.

## ADR-050: Persistenza confirm token su DB con fallback test-safe

- Data: 2026-03-06 00:46
- Stato: Accepted
- Contesto: lo store in-memory dei confirm token non era robusto in scenari multi-process e non soddisfaceva i requisiti di persistenza Step 3.
- Decisione: introdotto modello Prisma `ConfirmAction` e migrazione SQL; `confirmTokenService` ora persiste token con `expiresAt`/`consumedAt` e verifica hash payload. In `NODE_ENV=test` usa storage in-memory per evitare dipendenze DB nei test unit.
- Impatto: flusso two-step conferma pronto per runtime persistente; test stabili in CI locale.

## ADR-051: Enforcement Step 4 su tool distruttivi in chat pipeline

- Data: 2026-03-06 01:02
- Stato: Accepted
- Contesto: serviva enforcement concreto owner-mode + confirmToken two-step nella pipeline API chat/orchestrator, non solo a livello unitario del tool executor.
- Decisione: classificato `share.createLink` come distruttivo+owner-required; `/api/chat/send` integra orchestrator + toolExecutor e propaga outcome tool in SSE (`tool.result`) includendo token di conferma e codici errore conferma.
- Impatto: flusso conferma distruttivi validabile end-to-end via API test (required/missing/invalid/reuse) senza modifiche UI.

## ADR-052: Step 5 persistenza chat+tool audit con fallback test-safe

- Data: 2026-03-06 07:58
- Stato: Accepted
- Contesto: Step 4 aveva conferma tool E2E ma mancava persistenza DB del flusso chat e dell'audit mutazioni in route API.
- Decisione: in `/api/chat/send` introdotto adapter persistence con `createConversation/createMessage/writeToolAuditLog` e uso di `buildContextPack` su sorgenti reali disponibili; in test resta fallback/no-op salvo `ENABLE_DB_IN_TEST=1` per test integrazione controllati.
- Impatto: endpoint pronto per runtime persistente senza rompere suite locale; aggiunta tracciabilità DB di esecuzione tool mutanti.

## ADR-053: Step 6 hardening transazionale con graceful fallback

- Data: 2026-03-06 08:03
- Stato: Accepted
- Contesto: la persistenza Step 5 poteva lasciare scritture parziali (messaggi/audit separati) e mancava copertura esplicita su errore transazione.
- Decisione: introdotta persistenza turno chat in `prisma.$transaction` (user message + assistant message + audit mutation) e fallback non bloccante a risposta SSE quando il DB fallisce; completato adapter context-pack con query opzionali ai modelli disponibili.
- Impatto: ridotta probabilita di inconsistenza dati e migliorata resilienza API in produzione senza interrompere UX chat.

## ADR-054: Step publish sospeso per blocker infrastrutturali locali

- Data: 2026-03-06 08:05
- Stato: Accepted
- Contesto: richiesta pubblicazione completa Step 6 (commit/push/CI/merge/deploy/smoke) non eseguibile in questa sessione.
- Decisione: interrompere automazione publish e registrare procedura manuale minima perché bloccata da dipendenze esterne: licenza Xcode non accettata (blocca git locale) e API GitHub non raggiungibile in rete corrente.
- Impatto: codice Step 6 pronto localmente, ma non ancora pubblicato/mergiato/deployato da questa sessione.

## ADR-055: Publish Step 6 non eseguibile in sessione corrente nonostante retry

- Data: 2026-03-06 08:19
- Stato: Accepted
- Contesto: richiesta di completare commit/push/CI/merge/deploy/migrate/smoke dopo conferma utente di ambiente ok.
- Decisione: fermare workflow automatico in questa sessione perché i check runtime contraddicono la conferma (git non operativo; API GitHub non raggiungibile).
- Impatto: nessuna operazione remota eseguita; codice locale invariato rispetto a Step 6.

## ADR-056: Publish Step 6 ancora bloccato (session runtime mismatch)

- Data: 2026-03-06 08:22
- Stato: Accepted
- Contesto: ulteriore retry con conferma utente di ambiente operativo.
- Decisione: registrare mismatch tra conferma e stato runtime effettivo; nessuna operazione remota tentata oltre verifiche preliminari.
- Impatto: publish non completato in questa sessione.

## ADR-057: Chiusura definitiva Step 6 rinviata per evidenze remote insufficienti

- Data: 2026-03-06 08:47
- Stato: Accepted
- Contesto: richiesta conferma finale publish Step 6 dopo esecuzione manuale utente.
- Decisione: mantenere stato "verification pending" finché non sono disponibili prove remote coerenti (nuovo SHA su main o PR mergeata, run CI relativo, deploy URL, migrate deploy riuscito).
- Impatto: nessuna attestazione finale falsa; tracciabilità aderente ai dati osservabili.

## ADR-058: Verifica definitiva eseguita — Step 6 non pubblicato su main

- Data: 2026-03-06 12:33
- Stato: Accepted
- Contesto: utente ha fornito output completo dei comandi richiesti per validare publish.
- Decisione: chiudere la verifica con esito negativo definitivo sul publish Step 6 (stato attuale certificato: non mergeato/non deployato/non migrato).
- Impatto: backlog publish resta aperto; necessario un nuovo ciclo commit/push/PR/merge/deploy con evidenze corrette.

## ADR-059: Richiesta chiusura positiva respinta per assenza prove verificabili

- Data: 2026-03-06 12:34
- Stato: Accepted
- Contesto: utente dichiara publish Step 6 completato.
- Decisione: mantenere esito negativo finché le fonti verificabili non mostrano un nuovo SHA su main e run/deploy/migration coerenti.
- Impatto: evita false attestazioni di release.

## ADR-060: Conferma finale su evidenza utente — publish Step 6 non avvenuto

- Data: 2026-03-06 12:36
- Stato: Accepted
- Contesto: utente ha fornito output comandi finali richiesti.
- Decisione: chiudere definitivamente la verifica con esito negativo, senza eccezioni.
- Impatto: necessario nuovo ciclo publish per Step 6.
