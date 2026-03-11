Timestamp: 2026-03-11 16:24
Ruolo: agenti/categories/01-core-development/backend-developer.md

Riassunto
- Implementata persistenza lock specialista anche dopo passaggio su pagine profilo/impostazioni.
- Implementato reset completo database tramite Prisma force-reset.
- Risolto fallback inconcludente in /api/chat/send con risposta operativa contestuale.
- Aggiunto stream SSE `agent.thinking` per mostrare selezione/switch agenti e titolo ragionamento.
- Aggiornata UI thinking bubble per rendere visibile nome agente + titolo.
- Aggiunto test specifico su stream thinking; test suite mirata passata.

Decisioni / Next
- Procedere con commit e deploy per rendere visibili in production gli eventi `agent.thinking`.
- Eseguire smoke production post-deploy su lock specialista e thinking trace.
