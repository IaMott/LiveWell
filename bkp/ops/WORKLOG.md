# Worklog (append-only)

## 2026-03-04 16:17 — backend-developer
- Fatto: aggiunta priorità di routing su richiesta esplicita professionista (`medico`=>`mmg`, ecc.) in `routeMessage`.
- Output chiave: il passaggio di testimone ora è reale a livello orchestrator (specialista primario impostato subito, senza cambio-cappello implicito).
- Prossimo passo: push su branch PR e test conversazionale con trigger diretto professionista.
## 2026-03-04 16:21 — backend-developer
- Fatto: rimosso il blocco MVD che teneva sempre l'intervistatore come unico attore quando il dominio e chiaro.
- Output chiave: routing contestuale multi-professionista automatico (dietista+PT su obiettivi dimagrimento/composizione corporea) con intervistatore solo di supporto.
- Prossimo passo: push e test chat su casi non espliciti (senza richiesta diretta professionista).
