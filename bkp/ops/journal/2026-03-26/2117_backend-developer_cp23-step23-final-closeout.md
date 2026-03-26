timestamp: 2026-03-26 21:17
ruolo: backend-developer
prompt: chiudere davvero la Fase 1 shared text/live con persistenza canonica autonoma, canonical-first read path, compat layer ridotto a fallback e campagna test finale formalizzata

risultato:
- risolte incoerenze storiche Prisma con `migrate resolve --applied`
- applicata la migrazione `20260326205200_add_case_state_snapshot`
- confermato il write path primario del canonico su `CaseState`
- confermato il read path canonical-first
- aggiunti test finali su reload conversazione e `live-sync`
- suite minima finale verde

evidenze:
- `/Users/mattiamottisi/Desktop/LiveWell/prisma/schema.prisma`
- `/Users/mattiamottisi/Desktop/LiveWell/prisma/migrations/20260326205200_add_case_state_snapshot/migration.sql`
- `/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/case/persistence.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/chatPersistence.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/app/api/live-token/route.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/case-persistence.test.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/conversation-stateSnapshot-route.test.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/live-sync-stateSnapshot.test.ts`

decisioni:
- Fase 1 puo` essere considerata chiusa quando `stateSnapshot` e` primary sia in write sia in read path e il legacy resta solo fallback controllato

next:
- nessun ulteriore step obbligatorio per Fase 1
- follow-up solo se richiesto per cleanup legacy residuo
