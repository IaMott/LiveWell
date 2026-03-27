Timestamp: 2026-03-27 20:43
Ruolo: backend-developer

Prompt (riassunto)
- Correggere solo il fix pack prioritario emerso dal test reale utente.
- Perimetro: ordering transcript live, rimozione payload/tool interni dall'output utente/export, coerenza tra banner specialista, speaker reale e label messaggio.
- Aggiungere test mirati senza allargare il refactor.

Risultato (riassunto)
- Introdotta sanificazione condivisa dei contenuti assistant visibili in `src/lib/chat/userVisibleContent.ts`.
- `src/app/api/chat/transcript/route.ts` ora accetta metadata assistant, filtra i payload interni, scarta i messaggi assistant vuoti dopo sanitizzazione e persiste i messaggi in ordine con `message.create` sequenziale.
- `src/components/chat/ChatInput.tsx` ora serializza i save del transcript live con una queue locale; il turno assistant viene salvato dopo `live-sync`, usando lo snapshot aggiornato per domain/specialist label.
- `src/contexts/ChatContext.tsx` e `src/components/chat/ChatShell.tsx` ora appendono/mostrano il messaggio live con metadata speaker e fanno prevalere l'ultimo speaker assistant nel banner per evitare mismatch visivo.
- `src/app/api/chat/send/route.ts` usa la label dello speaker corrente (`activeSpecialist`) prima del lead-panel stale.
- `src/app/api/conversations/[id]/route.ts`, `src/app/api/conversations/[id]/export/route.ts` e `src/app/api/conversations/route.ts` filtrano i payload interni anche in load/export/preview.
- Aggiunti test: transcript route, ordering live client, banner specialistico, sanitizzazione load/export e guardrail speaker label.

Evidenze
- `npm run typecheck` verde
- `npm run lint` verde
- `npm run build` verde
- `npm run test -- tests/api/chat-transcript-route.test.ts tests/api/conversation-thinking-export.test.ts tests/api/chat-send-persistence.test.ts tests/chat-input-live-ordering.test.tsx tests/chat-shell-specialist-banner.test.tsx` verde
- `npm run test -- tests/chat-input-live-ordering.test.tsx tests/chat-shell-specialist-banner.test.tsx tests/api/chat-transcript-route.test.ts` verde

Decisioni
- Mantenere il fix nel perimetro stretto transcript/output/UI e non riaprire orchestrator/synthesis.
- Sanificare l'output visibile sia in scrittura che in lettura/export per coprire anche i dati storici gia` sporchi.

Next
- Eseguire publish remoto del fix pack.
- Verificare alias production e chiudere il passo con rischi residui reali.
