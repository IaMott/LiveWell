Timestamp: 2026-03-11 16:28
Ruolo: backend-developer

Prompt (riassunto)
- Ripulire titolo stream `agent.thinking` quando il summary contiene JSON o testo sporco.

Risultato
- Implementata normalizzazione titolo in `buildThinkingEvents()` con stripping e fallback.
- Confermato PASS test mirato su chat/send persistence.

Evidenze
- src/app/api/chat/send/route.ts
- tests/api/chat-send-persistence.test.ts

Next
- commit/push/deploy follow-up e smoke veloce.
