# Worklog (append-only)

## 2026-03-04 16:17 — backend-developer
- Fatto: aggiunta priorità di routing su richiesta esplicita professionista (`medico`=>`mmg`, ecc.) in `routeMessage`.
- Output chiave: il passaggio di testimone ora è reale a livello orchestrator (specialista primario impostato subito, senza cambio-cappello implicito).
- Prossimo passo: push su branch PR e test conversazionale con trigger diretto professionista.
## 2026-03-04 16:21 — backend-developer
- Fatto: rimosso il blocco MVD che teneva sempre l'intervistatore come unico attore quando il dominio e chiaro.
- Output chiave: routing contestuale multi-professionista automatico (dietista+PT su obiettivi dimagrimento/composizione corporea) con intervistatore solo di supporto.
- Prossimo passo: push e test chat su casi non espliciti (senza richiesta diretta professionista).
## 2026-03-04 16:30 — backend-developer
- Fatto: hardening anti-loop e refactor routing multi-agent reale (rimozione fallback operativo ad analista, filtraggio support non operativo, anti-stall handoff).
- Output chiave: eliminato pattern "ti contattera il PT" come stato terminale; ora in caso stall viene forzata domanda operativa concreta del professionista attivo.
- Prossimo passo: deploy preview e test end-to-end su scenario dimagrimento+allenamento.
## 2026-03-04 16:42 — frontend-developer
- Fatto: aggiunta feature "Nuova chat" + "Elimina storico" con API delete conversazioni.
- Output chiave: utente puo azzerare lo storico completo e ripartire da conversazione pulita sia dalla chat che dalla pagina Storico.
- Prossimo passo: push su PR e verifica UX in preview.
## 2026-03-04 16:47 — backend-developer
- Fatto: aggiunta eliminazione singola conversazione via API dedicata e pulsante cestino per ogni item nello Storico.
- Output chiave: mantenuta cancellazione totale e introdotta cancellazione puntuale con aggiornamento UI immediato.
- Prossimo passo: push PR e verifica da preview.
## 2026-03-04 16:55 — backend-developer
- Fatto: hardening endpoint DELETE /api/conversations su query conversationId vuota/blank con 400; estesi test API (401 + invalid query) e aggiunto test UI HistoryPageContent per delete singola/totale.
- Output chiave: evitata cancellazione bulk involontaria quando `conversationId` e presente ma invalido.
- Prossimo passo: attendere CI PR e validazione manuale preview.
## 2026-03-04 16:57 — code-reviewer
- Fatto: review hardening delete conversazioni (API + test API/UI + UX/localStorage).
- Output chiave: fix `400` su query invalida confermato corretto; nessun finding critico bloccante rilevato.
- Prossimo passo: eventuale hardening opzionale su richieste concorrenti in UI storico e test addizionali per path cancel/error.
## 2026-03-04 17:21 — backend-developer
- Fatto: aggiunti test UI mancanti su HistoryPageContent (confirm annullata, error fetch singola/totale) e lock anti-concorrenza tra delete bulk e single.
- Output chiave: prevenuti click concorrenti durante cancellazioni e coperti i branch UX di annullamento/errore con test dedicati.
- Prossimo passo: push e verifica CI preview.
