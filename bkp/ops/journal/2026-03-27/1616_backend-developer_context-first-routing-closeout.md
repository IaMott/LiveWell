2026-03-27 16:16
ruolo: backend-developer
prompt: chiudere la track obbligatoria ancora aperta sul routing multi-dominio context-first / LLM-first, poi chiudere i residui sicuri e rieseguire una review finale totale

risultato:
- introdotto `src/lib/ai/orchestrator/contextualRouting.ts` come resolver contestuale del routing
- `orchestrator.ts` usa ora LLM routing + snapshot/history prima delle euristiche statiche
- `case/protocol.ts` preserva lo speaker/panel corrente nei follow-up contestuali
- `agentSelection.ts` usa i preferredAgentIds ordinati come segnale piu forte del ranking e riduce gli hint statici a booster
- `tests/api/multi-agent-routing.test.ts`, `tests/api/orchestrator-routing-phase1.test.ts` e `tests/api/chat-orchestration.test.ts` dimostrano il nuovo comportamento
- chiuso anche il warning lint residuo in `src/components/profile/UserAvatar.tsx`

evidenze:
- `src/lib/ai/orchestrator/contextualRouting.ts`
- `src/lib/ai/orchestrator/orchestrator.ts`
- `src/lib/ai/orchestrator/routing.ts`
- `src/lib/ai/orchestrator/agentSelection.ts`
- `src/lib/ai/case/protocol.ts`
- `tests/api/multi-agent-routing.test.ts`
- `tests/api/orchestrator-routing-phase1.test.ts`
- `tests/api/chat-orchestration.test.ts`
- `src/components/profile/UserAvatar.tsx`

decisioni:
- mantenere keyword/hints statici come supporto/fallback ma non piu` come motore principale del path production
- preservare la continuita` del panel/speaker corrente nei follow-up contestuali per evitare takeover guidati dal legacy o da capability consult prematuri

validazione:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test -- tests/api/multi-agent-routing.test.ts tests/api/orchestrator-routing-phase1.test.ts tests/api/chat-orchestration.test.ts tests/api/multi-agent-execution.test.ts tests/api/live-sync-stateSnapshot.test.ts tests/api/chat-send-persistence.test.ts`
- `npm run test -- tests/api/case-protocol.test.ts tests/api/multi-agent-protocol.test.ts tests/api/orchestrator-decision-trace.test.ts tests/api/domain-detection-critical.test.ts`

next:
- publish remoto del fix
- review finale avversariale dell'intero progetto
