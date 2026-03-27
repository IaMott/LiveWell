timestamp: 2026-03-27 22:45
ruolo: backend-developer
prompt: publish remoto del fix UI domini/chat gia` validato localmente

risultato:
- commit applicativo creato: `ded544c` (`fix: restore domain-driven chat visuals`)
- push completato su `origin/main`
- deploy Vercel production completato su `https://livewell-klpef43xp-iamotts-projects.vercel.app`
- alias verificato: `https://livewell.mottisi.com` con redirect auth `307` verso `/login`

evidenze:
- src/components/chat/ChatInput.tsx
- src/components/chat/ChatShell.tsx
- src/components/chat/MessageList.tsx
- src/components/chat/MessageBubble.tsx
- tests/api/chat-shell-domain-visuals.test.ts
- tests/api/chat-input-domain-highlights.test.ts
- tests/api/message-bubble-domain-color.test.ts

validazione:
- npm run test -- tests/api/chat-shell-domain-visuals.test.ts tests/api/chat-input-domain-highlights.test.ts tests/api/message-bubble-domain-color.test.ts
- npm run typecheck
- npm run lint
- npm run build
- git push origin main
- npx vercel --prod --yes
- curl -I -sS https://livewell.mottisi.com

next:
- nessun fix obbligatorio aperto nel perimetro domini/chat
- eventuale passo successivo solo se l'utente vuole una verifica manuale browser-side su production
