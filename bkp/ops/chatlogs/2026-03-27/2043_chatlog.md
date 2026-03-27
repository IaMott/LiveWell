Timestamp: 2026-03-27 20:43
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto
- L'utente ha chiesto di correggere solo il fix pack prioritario emerso dal primo test reale.
- Ho isolato tre cluster: ordering transcript live, leakage di payload interni, mismatch tra speaker reale e banner specialista.
- Ho creato un checkpoint locale in `bkp/backups/2026-03-27/2030_feedback-fix-pack`.
- Ho introdotto un filtro condiviso per i contenuti assistant visibili.
- Ho reso il route transcript metadata-aware e con persistenza sequenziale.
- Ho serializzato lato client i save live per evitare che il messaggio assistant superi il messaggio user in ordine.
- Ho fatto salvare il turno assistant live dopo `live-sync`, usando lo snapshot aggiornato per domain e specialist.
- Ho riallineato il banner specialistico a cio` che l'utente vede davvero nell'ultimo messaggio assistant.
- Ho filtrato i payload interni anche in load/export/preview per pulire sia il runtime che i dati storici gia` sporchi.
- Ho aggiunto test nuovi e guardrail sui tre bug osservati.

Decisioni prese / next step
- Non toccare orchestrator/synthesis oltre la label speaker del route text.
- Procedere ora con commit, push, deploy e verifica rapida production.

Prompt chiave (riassunto)
- "Correggi solo il fix pack prioritario emerso dal test reale utente. Perimetro: ordering transcript live, rimozione payload/tool interni dall'output utente ed export, coerenza tra banner specialista, speaker reale e label messaggio."
