Timestamp: 2026-03-27 20:54
Ruolo: backend-developer

Prompt (riassunto)

- Correggere solo il cluster rimasto `PARTIAL` emerso dalla QA production:
  `/api/chat/transcript` non deve scartare tutto quando un assistant message contiene sia `Payload:` sia testo visibile.

Risultato (riassunto)

- `src/lib/chat/userVisibleContent.ts` aggiornato per rimuovere il payload strutturato iniziale sia in forma JSON sia in forma legacy `key:"value"`, preservando il testo assistant residuo sulla stessa riga.
- Guardrail aggiunti in:
  - `tests/api/chat-transcript-route.test.ts`
  - `tests/api/conversation-thinking-export.test.ts`
- Validazioni locali verdi:
  - `npm run test -- tests/api/chat-transcript-route.test.ts tests/api/conversation-thinking-export.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Publish remoto completato:
  - commit `fcf51b9`
  - deploy `https://livewell-pl7axw7ty-iamotts-projects.vercel.app`
  - alias `https://livewell.mottisi.com`
- Verifica production ripetuta con utente smoke reale:
  - transcript user: `va bene`
  - transcript assistant misto: `Payload: user.setAttribute {...} Ti aiuto a impostare il percorso.`
  - risultato: `savedMessages` contiene solo `Ti aiuto a impostare il percorso.`
  - load/export senza `Payload:`

Evidenze

- `src/lib/chat/userVisibleContent.ts`
- `tests/api/chat-transcript-route.test.ts`
- `tests/api/conversation-thinking-export.test.ts`
- `/tmp/livewell_qa2_transcript_assistant_inline_response.json`
- `/tmp/livewell_qa2_conversation.json`
- `/tmp/livewell_qa2_export.txt`

Decisioni

- Nessun refactor aggiuntivo su ordering o speaker path.
- Il follow-up resta confinato al cluster filtering transcript/output.

Next

- Nessun altro fix obbligatorio aperto in questo perimetro.
