Timestamp: 2026-03-27 12:53
Ruolo: backend-developer

Prompt (riassunto)
- Chiudere le track obbligatorie aperte dalla review avversariale:
  1. allineamento tool semantics text/live
  2. hardening del boundary canonico
  3. riduzione del legacy nel path caldo
  4. review finale e publish conclusivo

Risultato (riassunto)
- Introdotto `src/lib/tools/toolExecutionRouting.ts` come resolver condiviso per la selezione dell'agent tool per-call/panel-aware.
- `src/app/api/chat/send/route.ts` e `src/app/api/chat/live-sync/route.ts` convergono ora sullo stesso resolver e non ricostruiscono `CaseState` nei route hot-path quando `stateSnapshot` e` disponibile.
- `src/lib/ai/case/persistence.ts` usa validazione stretta sullo snapshot canonico e rifiuta snapshot malformed senza fallback legacy silenzioso.
- Aggiunti test negativi sul boundary canonico e un test text-route che dimostra il routing tool multi-agent per dominio.
- `ChatShell.tsx` non descrive piu` il live come single-agent.

Evidenze
- `src/lib/tools/toolExecutionRouting.ts`
- `src/app/api/chat/send/route.ts`
- `src/app/api/chat/live-sync/route.ts`
- `src/lib/ai/case/persistence.ts`
- `tests/api/case-persistence.test.ts`
- `tests/api/chat-send-persistence.test.ts`

Decisioni
- Il fix minimo corretto e` centralizzare la semantica tool in un resolver condiviso invece di duplicare logica tra text e live.
- Il boundary canonico deve essere fail-closed: snapshot presente ma invalido => nessun downgrade automatico al legacy.
- Il legacy ancora interno al protocol engine e` accettabile solo se non guida piu` il comportamento dei route principali.

Validazione
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test -- tests/api/case-persistence.test.ts tests/api/chat-send-persistence.test.ts tests/api/live-sync-stateSnapshot.test.ts`
- `npm run test -- tests/api/live-token-security.test.ts tests/api/live-token-fallback-observability.test.ts tests/api/chat-send-security.test.ts tests/api/domain-canonical-write-read.e2e.test.ts tests/api/chat-orchestration.test.ts tests/api/multi-agent-execution.test.ts`

Next
- Commit mirato, push su `origin/main`, deploy production e verifica alias.
