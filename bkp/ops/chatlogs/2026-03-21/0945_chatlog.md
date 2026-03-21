2026-03-21 09:45
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto
- Richiesti due micro-fix strettissimi sul baseline `1b64da1`.
- Pre-flight letto da `STATUS.md`, `WORKLOG.md`, `DECISIONS.md`.
- Checkpoint Git creato su `backup/2026-03-21_1015_two-conversation-residuals`.
- Isolati i bias semantici:
  - `separando` non agganciato bene nei punteggi owner/consult
  - sleep resume puro ancora troppo permissivo verso consulti extra
- Patch applicate in `domainDetection.ts`, `protocol.ts`, `registry.ts`.
- Test mirati aggiornati:
  - practical separation con figli/soldi/problemi pratici
  - resume sonno con memoria/ore di sonno/caffeina tardi
  - negativi anti-career e anti-relationship
- Suite richieste verdi:
  - `domain-detection-critical`
  - `case-protocol`
  - `runtime-trigger-guards`
  - `orchestrator-interview-flow`
  - `orchestrator-domain-persistence`
  - `orchestrator-synthesis`
  - `artifact-governance`
  - `chat-send-persistence`
- `typecheck` e `build` verdi.
- Harness temporaneo sul team reale eseguito e rimosso; output salvato in `/tmp/livewell_review_conversation_residuals_postfix.json`.

Decisioni prese / next step
- Practical separation spostato verso `coordination/life-organizer`.
- Sleep resume puro con owner `sleep-coach` non deve aprire consulti extra.
- Next: commit applicativo, push, deploy e report finale.

Prompt chiave (riassunto)
- Correggere solo i due finding reali confermati dalla review, senza refactor e senza toccare UI.
