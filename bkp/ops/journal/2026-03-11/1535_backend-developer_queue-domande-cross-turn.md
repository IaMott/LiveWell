# Journal

Timestamp: 2026-03-11 15:35
Ruolo: backend-developer
Prompt (riassunto): garantire che con regola 1-domanda-per-turno le domande residue non vengano dimenticate e verificare assenza domande preimpostate.

Risultato (riassunto)
- Implementata queue domande con persistenza su agentWorkspace (`pendingQuestions`,`pendingDomain`).
- Ogni turno: il sistema fa una domanda, salva le residue, e le ripropone ai turni successivi.
- Filtro globale template in consensus confermato (non per singolo agente).
- Scan su `src/` conferma assenza delle stringhe template segnalate.

Evidenze
- src/lib/ai/orchestrator/orchestrator.ts
- src/lib/ai/context/contextPackBuilder.ts
- src/lib/ai/types.ts
- src/lib/ai/consensus/consensusEngine.ts
- tests/api/orchestrator-domain-persistence.test.ts

Decisioni
- Persistenza coda domande nel workspace conversazione per continuità multi-turno.

Next
- Commit/push/deploy e smoke production multi-turno.
