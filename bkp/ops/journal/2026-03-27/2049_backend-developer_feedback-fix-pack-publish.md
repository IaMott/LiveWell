Timestamp: 2026-03-27 20:49
Ruolo: backend-developer

Prompt (riassunto)

- Chiudere solo il fix pack prioritario emerso dal test reale utente:
  1. ordering transcript live
  2. rimozione payload/tool interni dall'output utente ed export
  3. coerenza tra banner specialista, speaker reale e label messaggio
- aggiungere test mirati senza allargare il refactor

Risultato (riassunto)

- Publish remoto completato del fix pack prioritario.
- Commit applicativo: `f282175` (`fix: stabilize live transcript and specialist visibility`)
- Push completato su `origin/main`
- Deploy Vercel production completato su `https://livewell-2bqy39zfv-iamotts-projects.vercel.app`
- Alias verificato su `https://livewell.mottisi.com` con risposta `HTTP 307` verso `/login`

Evidenze

- `src/app/api/chat/transcript/route.ts`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ChatShell.tsx`
- `src/contexts/ChatContext.tsx`
- `src/lib/chat/userVisibleContent.ts`
- `tests/api/chat-transcript-route.test.ts`
- `tests/chat-input-live-ordering.test.tsx`
- `tests/chat-shell-specialist-banner.test.tsx`
- `tests/api/conversation-thinking-export.test.ts`
- `tests/api/chat-send-persistence.test.ts`

Decisioni

- Il fix e` stato chiuso nei boundary runtime, non con polish UI.
- Il contenuto assistant visibile passa ora sempre da un sanitizer condiviso.
- L'ordine transcript live e` garantito dal client tramite serializzazione delle write e append dei soli messaggi realmente persistiti.

Next

- Attendere nuovo test reale utente in production per confermare ordering, assenza di payload interni e coerenza speaker/banner.
