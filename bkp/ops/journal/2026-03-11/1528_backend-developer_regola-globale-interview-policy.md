# Journal

Timestamp: 2026-03-11 15:28
Ruolo: backend-developer
Prompt (riassunto): rendere strutturale e globale la regola anti-domande preimpostate per tutti gli agenti/professionisti.

Risultato (riassunto)
- Policy globale centralizzata in consensus engine.
- Rimozione domande template/generiche.
- Limite globale a una sola domanda integrativa.
- Export DB dinamico mantenuto come cartella clinica strutturata senza frammenti chat/workspace.

Evidenze
- src/lib/ai/consensus/consensusEngine.ts
- src/lib/ai/orchestrator/orchestrator.ts
- src/lib/ai/gemini.ts
- tests/api/consensus-attributes-filter.test.ts

Decisioni
- Le regole di comportamento non devono vivere nei singoli profili agente ma nel layer centrale di consenso/orchestrazione.

Next
- Commit/push/deploy e smoke production.
