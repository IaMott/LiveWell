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

## ADR-061: Publish Step 6 merge effettuato ma release non chiudibile (CI main failure)
- Data: 2026-03-06 12:40
- Stato: Accepted
- Contesto: evidenze finali utente e verifica remota diretta.
- Decisione: classificare stato come "merged but unhealthy": main avanzato a `8ee4344...`, ma run CI `22762076827` su main è `failure`; non consentita chiusura positiva definitiva.
- Impatto: necessario step correttivo post-merge (fix failure + nuova CI verde) prima di dichiarare step chiuso.

## ADR-062: Fix post-merge Step 6 tramite reintroduzione moduli mancanti + fallback slash-tool
- Data: 2026-03-06 12:58
- Stato: Accepted
- Contesto: la merge Step 6 su main ha introdotto failure CI per import mancanti in `/api/chat/send` e regressione test audit tool in assenza di tool-calls da consensus.
- Decisione: applicare patch minime additive in PR #5 senza refactor: aggiunta moduli mancanti `security`, `ai`, `tools` e fallback di esecuzione a `requestedToolCalls` quando `consensus.toolCallsToExecute` è vuoto.
- Impatto: ripristino atteso della pipeline CI per endpoint chat e preservazione del comportamento `/tool` nei test di persistenza/audit.

## ADR-063: PR #5 non mergeabile finché Vercel/CI non sono verdi sul head corrente
- Data: 2026-03-06 13:05
- Stato: Accepted
- Contesto: richiesta merge PR #5 condizionata da check verdi su fix post-merge Step 6.
- Decisione: non procedere al merge perché `Vercel` è in failure sul head corrente PR e il rerun CI disponibile è legato a SHA precedente (`d476c34`), non ai commit più recenti (`0ffca7d`, `1fc0c70`).
- Impatto: `main` resta stabile su `8ee4344...`; necessaria risoluzione check PR prima della pubblicazione definitiva.

## ADR-064: Stabilizzazione PR #5 via branch pulita + separazione tipi runtime AI
- Data: 2026-03-06 13:34
- Stato: Accepted
- Contesto: PR #5 aveva check instabili (CI non allineata ai nuovi commit, Vercel failure in build/typecheck) con conflitti tra tipi legacy (`src/lib/ai/types.ts`) e nuovi moduli Step 6.
- Decisione: mantenere `types.ts` legacy per compatibilità esistente e introdurre `src/lib/ai/runtime-types.ts` per i nuovi moduli (`chat/send`, orchestrator runtime, tool executor/rbac), aggiungendo compat adapter `getServerEnv` in `validators/env.ts`.
- Impatto: check PR #5 ripristinati verdi senza refactor ampio del dominio legacy.

## ADR-065: Chiusura definitiva Step 6 fix post-merge
- Data: 2026-03-06 16:12
- Stato: Accepted
- Contesto: PR #5 era pronta al merge con check verdi (CI + Vercel preview).
- Decisione: eseguito merge squash su `main` e validazione finale end-to-end con tre prove obbligatorie: SHA `origin/main`, run CI `main`, deployment production.
- Impatto: Step 6 fix ufficialmente chiuso; baseline `main` ripristinata in stato healthy.

## ADR-066: Phase B — STEP 1 Auth: NextAuth v5 reale, rimozione trust-header
- Data: 2026-03-06
- Stato: Accepted
- Contesto: la baseline `feat/step6-publish` usava `x-user-id`/`x-user-role` header in chiaro come unica fonte di autenticazione (FC-01, FC-08 del Phase A audit).
- Decisione: split auth `auth.config.ts` (edge) + `auth.ts` (Node.js + Credentials + bcrypt); `getAuthUserId/getAuthRole/getAuthOwnerMode` con bypass test-safe su `NODE_ENV=test`; middleware protegge solo `/profile/*`; API routes gestiscono auth autonomamente. Trust-header rimosso da tutti i route handler.
- Impatto: eliminato rischio impersonation; test suite invariata (bypass header solo in NODE_ENV=test).

## ADR-067: Phase B — STEP 2 DB Schema: tracker/artifact/geo models + User.role
- Data: 2026-03-06
- Stato: Accepted
- Contesto: ContextPackBuilder referenziava modelli Prisma inesistenti (BodyMetricEntry, Meal, WorkoutSession, MindfulnessEntry, FileAsset, RecommendationArtifact, GeoPreference), causando ritorno silenzioso di array vuoti.
- Decisione: aggiunta al schema Prisma di tutti i modelli mancanti con indici appropriati; campo `role` su User; migrazione additive-only con IF NOT EXISTS guard.
- Impatto: ContextPack ora può accedere a dati reali; nessuna breaking change su schema esistente.

## ADR-068: Phase B — STEP 3 DB Adapter Layer con geo privacy-first
- Data: 2026-03-06
- Stato: Accepted
- Contesto: mancava un layer tipizzato centralizzato per le query DB usate da route handler, ContextPackBuilder e tool handler.
- Decisione: creato `src/lib/db/index.ts` con funzioni tipizzate per tutti i domini; invarianti geo privacy: `upsertCoarseLocation` arrotonda lat/lon a 2 decimali (≈1km); `getCoarseLocation` non espone mai le coordinate raw; `clearCoarseLocation` svuota tutti i campi geo su opt-out.
- Impatto: DB adapter pronto per ContextPack reale e tool handler; contratto privacy geo documentato e applicato a livello codice.

## ADR-069: Phase B — STEP 4 Gemini: client reale con mock fallback e JSON output contract
- Data: 2026-03-06
- Stato: Accepted
- Contesto: `buildDeterministicLlm` in `chat/send/route.ts` restituiva sempre testo statico, rendendo il sistema di agenti completamente non funzionale in produzione.
- Decisione: creato `src/lib/ai/gemini.ts` con `createGeminiClient()` che usa `@google/genai` SDK; `JSON_OUTPUT_INSTRUCTION` appesa al system prompt di ogni agente per forzare output JSON compatibile con `AgentProposal`; mock fallback automatico quando `GEMINI_API_KEY` assente (dev/test sicuro); `AI_MODEL` in `env.ts` (default `gemini-2.5-flash`). In `chat/send/route.ts`: Gemini per messaggi normali, deterministico solo per direttive `/tool` esplicite.
- Impatto: sistema agenti operativo in produzione; test esistenti invariati (nessun API key richiesta); retrocompatibilità `/tool` directive mantenuta.

## ADR-070: Phase B — STEP 5 Tool handlers: DB mutations reali con flag test-safe
- Data: 2026-03-06
- Stato: Accepted
- Contesto: tutti i tool handler in `chat/send/route.ts` restituivano `{ saved: true }` stub; nessuna mutazione DB veniva eseguita dalla pipeline agenti.
- Decisione: creato `src/lib/tools/handlers.ts` con `realToolHandlers` (Prisma) e `stubToolHandlers` (test-safe); `buildToolExecutor` accetta `useRealHandlers: boolean` = `isDbPersistenceEnabled()`. `nutrition.createFoodItem` salvato come `RecommendationArtifact` (nessun modello FoodItem separato nel schema). Mapping `category=professional → type=specialist` per Notification. `share.createLink` e `export.pdf` restano stub in attesa di feature dedicate.

## ADR-071: Phase B — STEP 6 Geo module: geolocalizzazione privacy-first
- Data: 2026-03-06
- Stato: Accepted
- Contesto: `ContextPack` non includeva alcun dato geografico; `Permissions-Policy` bloccava la browser geolocation API (`geolocation=()`); nessun tool o API route per gestire le preferenze geo utente.
- Decisione: (1) `next.config.ts`: `geolocation=()` → `geolocation=(self)` per abilitare browser API. (2) `types.ts`: aggiunto `geo?` a `ContextPack` (solo campi coarse: country/region/city/timezone/accuracy — mai coordinate raw). (3) `contextPackBuilder.ts`: `geoPreference` opzionale in `DbClient`; `geo` incluso nel pack solo se `enabled===true`. (4) `toolRegistry.ts`: 3 nuovi tool allowlistati — `geo.setPreference`, `geo.updateCoarseLocation`, `geo.clearLocation`. (5) `handlers.ts`: handler reali via `setGeoPreference`, `upsertCoarseLocation`, `clearCoarseLocation` da `@/lib/db`. (6) Nuovo `POST /api/geo/update`: auth + rate-limit (20/min) + toggle + upsert/clear coarse location. (7) `chat/send/route.ts`: `geoPreference.findUnique` aggiunto al DbClient del ContextPackBuilder.
- Privacy invarianti: lat/lon ricevuti dal browser ma salvati arrotondati a 2dp (≈1km); mai ritornati ai caller; `geo` nel ContextPack mai incluso in share pubblici o notifiche push.
- Impatto: tool calls del sistema agenti persistono realmente nel DB in produzione; test suite invariata (stub in NODE_ENV=test).

## ADR-072: Unified Orchestration Layer — fusione Orchestrator + Interviewer (rev. 2 — modello corretto)
- Data: 2026-03-06
- Stato: Accepted (corretto da rev. 1 errata)
- Contesto: il modello precedente trattava Orchestrator e Interviewer come ruoli separati. Rev. 1 di questo ADR aveva erroneamente proposto di bloccare i domain agents finché la baseline non fosse completa. Questo era sbagliato: sono i professionisti stessi a sapere quali dati servono per la loro analisi; l'invocazione parallela del team è intenzionale e garantisce copertura multi-fronte.
- Gap reale identificato (3 punti): (1) le domande di gating dai proposal del team non venivano deduplicate semanticamente — solo per stringa uguale; (2) le risposte dell'utente alle domande non venivano sistematicamente salvate nel profilo DB prima del turno successivo, impedendo l'arricchimento progressivo del ContextPack; (3) nessuna garanzia esplicita di isolamento di dominio tra agenti.
- Decisione corretta: Orchestrator e Interviewer vengono fusi in un unico **Unified Orchestration Layer** (UOL) con ruolo di **coordinatore + gestore feedback loop**, NON di gate/blocco. Invarianti: (1) i domain agents vengono SEMPRE invocati in parallelo — sono loro a conoscere i propri dati necessari; (2) il UOL raccoglie le questions dai proposal e le deduplica semanticamente prima di presentarle all'utente; (3) quando l'utente risponde il UOL salva i dati in DB (`user.updateProfile`) prima del turno successivo; (4) il UOL garantisce isolamento di dominio rilevando e correggendo sconfinamenti cross-domain; (5) il team lavora su più fronti in parallelo per solidità e copertura dell'analisi.
- Impatto documenti: `docs/ARCHITECTURE.md`, `docs/AGENT_SYSTEM_SPEC.md`, `docs/AGENT_PROMPT_ARCHITECTURE.md` aggiornati con modello corretto.
- Impatto codice (backlog B7): `src/lib/ai/orchestrator/orchestrator.ts` — il flow `Promise.all` per gli agenti è corretto e va mantenuto. Va aggiunto: (a) deduplicazione semantica delle questions nel `collectGatingQuestions` del ConsensusEngine; (b) quando il turno contiene domande di gating, proporre automaticamente `user.updateProfile` con i dati eventualmente già forniti nella risposta corrente; (c) logica di isolamento dominio nel ConsensusEngine per filtrare contenuti cross-domain.
