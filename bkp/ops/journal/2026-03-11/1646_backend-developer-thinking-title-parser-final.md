Timestamp: 2026-03-11 16:46
Ruolo: backend-developer

Prompt (riassunto)
- Eliminare definitivamente prefissi tecnici nel titolo `agent.thinking`.

Risultato
- Parser titolo aggiornato con estrazione dopo ultima `summary:`.
- Test mirato PASS.

Evidenze
- src/app/api/chat/send/route.ts
- tests/api/chat-send-persistence.test.ts

Next
- push/deploy finale + smoke conferma.
