timestamp: 2026-03-27 22:40
ruolo: backend-developer
prompt: ripristinare il comportamento visuale dei domini nella chat; riaccendere i pulsanti della barra in basso sia in mono che in multi-dominio, farli switchare al cambio del dominio, colorare le bolle assistant col dominio attivo e rimuovere il banner alto di modalità specialistica

risultato:
- individuata la regressione principale in `src/components/chat/ChatShell.tsx`: il dominio visuale privilegiava ancora l'ultimo assistant con metadata dominio invece del dominio canonico corrente (`activeDomain/stateSnapshot`)
- `src/components/chat/ChatInput.tsx` esteso per supportare `activeDomains` multipli e highlight simultaneo dei pulsanti nella barra in basso
- `src/components/chat/ChatShell.tsx` aggiornato per rimuovere il banner alto `modalità specialista attiva` e propagare `activeDomain/activeDomains` coerenti ai componenti figli
- `src/components/chat/MessageList.tsx` e `src/components/chat/MessageBubble.tsx` aggiornati per colorare le bolle assistant con il dominio attivo di fallback
- aggiunti guardrail in `tests/api/chat-shell-domain-visuals.test.ts`, `tests/api/chat-input-domain-highlights.test.ts`, `tests/api/message-bubble-domain-color.test.ts`

evidenze:
- src/components/chat/ChatInput.tsx
- src/components/chat/ChatShell.tsx
- src/components/chat/MessageList.tsx
- src/components/chat/MessageBubble.tsx
- tests/api/chat-shell-domain-visuals.test.ts
- tests/api/chat-input-domain-highlights.test.ts
- tests/api/message-bubble-domain-color.test.ts

decisioni:
- il dominio canonico corrente vince sul metadata stale dell'ultimo assistant
- il multi-dominio resta highlight additivo, non sostituisce il focus corrente
- il banner alto specialistico viene rimosso e la specializzazione resta indicata nel messaggio assistant

validazione:
- npm run test -- tests/api/chat-shell-domain-visuals.test.ts tests/api/chat-input-domain-highlights.test.ts tests/api/message-bubble-domain-color.test.ts
- npm run typecheck
- npm run lint
- npm run build

next:
- commit, push, deploy e verifica dell'alias production
