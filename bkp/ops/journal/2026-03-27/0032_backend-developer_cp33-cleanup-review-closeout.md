2026-03-27 00:32
Ruolo: backend-developer
Prompt (riassunto): completare il cleanup residuo sicuro dopo la chiusura architetturale shared text/live e poi fare review critica completa, correggendo eventuali problemi high/bloccanti prima della chiusura.

Risultato (riassunto)
- rimosso il codice morto `src/lib/ai/orchestrator/routingLegacy.ts`
- rimosso `activeSpecialistId` dal request body text in `src/contexts/ChatContext.tsx`
- tipizzato `ui.state.stateSnapshot` nel contract SSE in `src/app/api/chat/send/chatStream.ts`
- resa coerente l'emissione `ui.state` in `src/app/api/chat/send/route.ts` con `toSse()`
- review critica completata senza finding `blocking` o `high`

Evidenze
- `src/contexts/ChatContext.tsx`
- `src/app/api/chat/send/chatStream.ts`
- `src/app/api/chat/send/route.ts`
- `src/lib/ai/orchestrator/routingLegacy.ts`
- `npm run typecheck`
- `npm run build`
- `npm run test -- tests/api/chat-send-persistence.test.ts tests/api/chat-send-security.test.ts tests/api/case-persistence.test.ts`

Decisioni
- cleanup finale guidato solo da evidenze forti di inutilita` o ambiguita` contrattuale
- residui legacy storici lasciati vivi solo dove ancora plausibilmente necessari

Next
- commit, push, deploy e chiusura finale con raccomandazioni residue non bloccanti
