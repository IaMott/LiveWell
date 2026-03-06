# STEP 10 — Profile Modules Backlog (prioritario)

Data piano: 2026-03-04 19:32
Fonte verita: bkp/ops (STATUS, WORKLOG, DECISIONS)
Owner: project-manager

## Obiettivo STEP 10

Portare i moduli profilo a stato production-ready, con coerenza tra dati raccolti in chat, persistenza DB, storico/audit e UX completa nelle sezioni profilo.

## Priorita P0 (bloccanti)

1. Allineamento schema dati profilo

- Definire struttura canonica per `health`, `nutrition`, `training`, `mindfulness`, `goals`, `settings`.
- Mappare campi obbligatori/facoltativi e normalizzare nomi chiave.
- Output: matrice campi + validatori Zod condivisi.

2. Validazione server-side robusta su `/api/profile`

- Introdurre validazione per sezione con errori espliciti.
- Proteggere da payload parziali incoerenti e tipi errati.
- Output: route harden + test API profilo.

3. Sync chat -> profilo senza conflitti

- Garantire merge idempotente quando chat aggiorna il profilo.
- Definire precedenze tra input utente diretto e update AI.
- Output: regole merge documentate + test integrazione.

4. Storico profilo per sezione

- Salvare timeline modifiche per singola sezione (chi/cosa/quando/perche).
- Rendere interrogabile lo storico da UI profilo.
- Output: struttura audit history + endpoint lettura storico.

## Priorita P1 (alta)

5. UX editing sezioni profilo

- Uniformare stati `loading/success/error` in tutte le pagine profilo.
- Aggiungere feedback utente chiari su salvataggio e validazione.
- Output: comportamento UI consistente in tutte le 8 sezioni.

6. Gestione allegati per contesto sezione

- Collegare allegati provenienti da chat/live alle sezioni profilo corrette.
- Mostrare riferimenti allegati nello storico sezione.
- Output: mapping allegati->sezione + rendering UI.

7. Completezza dati MVD nelle sezioni

- Evidenziare campi mancanti per dominio direttamente nelle pagine profilo.
- Supportare "prossimo dato da completare" coerente con orchestrator.
- Output: indicatori di completezza per sezione.

## Priorita P2 (media)

8. Accessibilita e mobile profile pages

- Verifica focus management, contrasto e usabilita mobile.
- Output: fix a11y/mobile sui componenti profilo.

9. Export storico profilo

- Aggiungere export testuale/JSON dello storico per sezione.
- Output: endpoint export + bottone UI.

10. Pulizia tecnica profilo

- Ridurre duplicazioni tra componenti pagina profilo.
- Estrarre helpers condivisi per serializzazione/deserializzazione.
- Output: refactor non funzionale con test verdi.

## Piano esecutivo breve (ordine consigliato)

- Sprint 10.1: Task 1,2,3
- Sprint 10.2: Task 4,5,6
- Sprint 10.3: Task 7,8,9,10

## Sprint 10.3 — Kickoff esecutivo (2026-03-05 12:43)

### Scope sprint

- Completezza dati MVD per sezione profilo.
- Hardening UX accessibilita/mobile sulle pagine profilo.
- Export storico profilo per sezione.
- Pulizia tecnica componenti profilo senza regressioni.

### Piano task (brevi) con priorita

1. P0 API: `GET /api/profile/completeness` con percentuale e campi mancanti per sezione.
2. P0 UI: badge/indicatori "completezza" in `ProfileNav` e pagine sezione con "prossimo dato mancante".
3. P0 TEST: API test su casi completi/incompleti e fallback legacy.
4. P1 API: endpoint export storico sezione (`GET /api/profile/history/export?section=&format=json|txt`).
5. P1 UI: azione export da `HistoryPageContent` con stato loading/error/success uniforme.
6. P1 TEST: test API export (auth, query invalida, contenuto) + test UI sul trigger export.
7. P1 UI: passata a11y/mobile su pagine profilo (focus order, label, contrasto base, breakpoint).
8. P2 REFACTOR: estrazione helper comuni serializzazione/parsing profilo e riduzione duplicazioni page-content.
9. P2 TEST: smoke regressivo su edit/save sezioni principali (`nutrition/training/mindfulness/goals`).

### Criteri di accettazione Sprint 10.3

- Esiste un indicatore affidabile di completezza per ogni sezione profilo e viene mostrato in UI.
- Export storico per sezione disponibile in almeno `json` e `txt` con controllo auth.
- UX profilo mantiene stati coerenti (`loading/success/error`) anche su export e completezza.
- Nessuna regressione sui flussi di update profilo e storico gia rilasciati in Sprint 10.1/10.2.
- Test API/UI nuovi verdi in CI su `main`/PR di sprint.

## Definition of Done STEP 10

- API profilo validate + test coverage minima su update/read/history.
- Sync chat->profilo stabile e tracciabile.
- Sezioni profilo coerenti UX e completezza dati visibile.
- Storico/audit consultabile per sezione.
