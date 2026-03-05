
## ADR-010: PR operativa su branch rebased
- **Date**: 2026-03-04 15:26
- **Decision**: usare  come branch sorgente PR verso .
- **Rationale**: branch precedente aveva storia non allineata con  e causava problemi operativi.

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
