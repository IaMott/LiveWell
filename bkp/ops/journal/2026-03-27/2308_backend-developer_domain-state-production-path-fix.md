2026-03-27 23:08
ruolo: backend-developer
prompt: correggere il path production che serializza `general` verso la UI domini/chat, facendo arrivare il dominio canonico reale a `ui.state`, `stateSnapshot` e `assistant.domain`

risultato:
- `src/lib/ai/orchestrator/orchestrator.ts` ora costruisce un `stateSnapshot` canonico arricchito, invece di limitarsi al fallback `general` generato da un `CaseState` privo di metadati dominio
- il snapshot usa routing rilevato, speaker corrente, specialista effettivo, agenti selezionati e snapshot precedente per preservare il pannello non-lead ancora attivo
- `tests/api/chat-orchestration.test.ts` copre i casi `training` e `health+training`
- `tests/api/chat-send-persistence.test.ts` verifica che il dominio assistant persistito segua il `leadDomain` canonico

evidenze:
- `src/lib/ai/orchestrator/orchestrator.ts`
- `tests/api/chat-orchestration.test.ts`
- `tests/api/chat-send-persistence.test.ts`
- backup locale: `bkp/backups/2026-03-27/2302_domain-state-backend-fix/`

decisioni:
- non toccare il fix UI puro
- correggere il producer del dato production-facing nel path orchestrator

next:
- commit, push, deploy
- rieseguire smoke production sugli scenari training e health+training già falliti in QA
