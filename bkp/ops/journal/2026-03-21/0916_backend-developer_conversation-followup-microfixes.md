Timestamp: 2026-03-21 09:16
Ruolo: backend-developer
Prompt (riassunto): applicare micro-fix stretti al cluster conversazionale dei follow-up specialistici già avviati, evitando intake baseline fuori timing, drift burnout/sonno, return baton prematuro legal/financial e resume deboli.

Risultato (riassunto):
- corretti `interviewFlow.ts`, `domainDetection.ts`, `protocol.ts`, `registry.ts`, `synthesis.ts`
- follow-up focalizzati sul problema attivo invece di L1/L2/generic domain intake nei casi già ricchi o ripresi da memoria
- ridotti drift `sonno -> nutrition` e `burnout/focus -> career`
- impedito il return baton prematuro nei consulti `consulente-legale` e `financial-planner` quando il messaggio resta nel loro focus
- rinforzata l’istruzione di synthesis contro il restart di intake generico su casi già noti
- test verdi: `53/53` mirati, `37/37` guardie, `typecheck`, `build`

Evidenze:
- src/lib/ai/orchestrator/interviewFlow.ts
- src/lib/ai/domain/domainDetection.ts
- src/lib/ai/case/protocol.ts
- src/lib/ai/capabilities/registry.ts
- src/lib/ai/orchestrator/synthesis.ts
- tests/api/orchestrator-interview-flow.test.ts
- tests/api/domain-detection-critical.test.ts
- tests/api/case-protocol.test.ts
- tests/api/orchestrator-synthesis.test.ts

Decisioni:
- priorità conversazionale al problema attivo rispetto alla raccolta dati generica
- fix confinato ai layer canonici del runtime; nessun refactor generale

Next:
- commit, push, deploy
- nuova validazione mirata del cluster conversazionale post-fix
