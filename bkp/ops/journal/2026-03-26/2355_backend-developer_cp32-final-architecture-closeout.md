timestamp: 2026-03-26 23:55
ruolo: backend-developer
prompt: chiudere il piano operativo post-Fase-1 fino al target architetturale finale canonical-first text/live senza riaprire la Fase 1

risultato:
- completato cleanup snapshot-first del bordo text/live e micro-fix canonical-first nel core orchestration
- `chat/send` emette compat fields derivati dal lead panel canonico
- `ChatContext` e `ChatShell` leggono prima `stateSnapshot`
- `orchestrator` e `fastPaths` fanno vincere `caseStateSnapshot` quando il legacy e` in conflitto
- nessun consumer legacy e` stato rotto; i fallback residui restano adapter controllati

evidenze:
- `/Users/mattiamottisi/Desktop/LiveWell/src/app/api/chat/send/route.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/contexts/ChatContext.tsx`
- `/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/ChatShell.tsx`
- `/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/types.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/orchestrator/orchestrator.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/orchestrator/fastPaths.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-send-persistence.test.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/chat-orchestration.test.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/multi-agent-execution.test.ts`

decisioni:
- il canonico vince sempre nei conflitti `snapshot vs legacy`
- i campi legacy esterni restano solo derived compatibility fields
- `CaseState` resta adapter interno transitorio del protocol, non source of truth dei boundary

validazione:
- `npm run typecheck`
- `npm run build`
- `npm run test -- tests/api/chat-orchestration.test.ts tests/api/multi-agent-execution.test.ts tests/api/chat-send-persistence.test.ts tests/api/live-sync-stateSnapshot.test.ts tests/api/live-token-fallback-observability.test.ts tests/api/conversation-stateSnapshot-route.test.ts tests/api/case-persistence.test.ts`
- `npm run test -- tests/api/chat-send-security.test.ts tests/api/live-token-security.test.ts tests/api/domain-canonical-write-read.e2e.test.ts`

next:
- commit, push, deploy e verifica post-deploy finale
