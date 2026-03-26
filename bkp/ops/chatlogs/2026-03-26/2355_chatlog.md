timestamp: 2026-03-26 23:55
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- proseguito in autonomia dopo la migrazione dei consumer server principali al boundary canonico
- chiuso il cleanup snapshot-first del bordo text/live:
  - `chat/send/route.ts` deriva i compat fields dal lead panel canonico
  - `ChatContext.tsx` espone `stateSnapshot` e lo usa come fonte primaria
  - `ChatShell.tsx` usa il canonico prima dei fallback legacy
- chiuso il micro-fix del core orchestration:
  - `orchestrator.ts` usa `caseStateSnapshot` come base prioritaria se il legacy e` in conflitto
  - `fastPaths.ts` usa il panel canonico per il compatibility speaker
- aggiunti test mirati su precedence canonica e ui.state snapshot-first
- validazioni finali verdi: typecheck, build, 108 test mirati, security smoke tests, e2e canonical read/write

decisioni prese:
- il legacy esterno (`activeDomain`, `activeSpecialistId`, `specialistName`) resta solo adapter derivato
- `CaseState` sopravvive solo come adapter interno transitorio del protocol
- il criterio di chiusura architetturale e` soddisfatto senza riaprire la Fase 1

next step:
- commit
- push
- deploy
- verifica post-deploy
