Timestamp: 2026-03-27 21:40
Ruolo: qa-expert

Prompt (riassunto)

- Verificare in production il fix pack gia` deployato solo su:
  1. ordering transcript live
  2. assenza di payload/tool interni nei messaggi e nell'export
  3. coerenza tra banner specialista e speaker reale

Risultato (riassunto)

- Utente smoke creato e autenticato con sessione production reale.
- Ordering transcript: PASS nel path verificato.
- Filtering output: PARTIAL.
- Speaker consistency: PASS lato data path production.

Evidenze

- Conversazione transcript verificata: `cmn9d30ky0002rv12rhobln6q`
- Conversazione `chat/send` verificata: `cmn9d6vqt0008rv12tyzlfjgh`
- File temporanei:
  - `/tmp/livewell_qa_conversation_after_plain.json`
  - `/tmp/livewell_qa_export_after_plain.txt`
  - `/tmp/livewell_qa_chat_send.sse`
  - `/tmp/livewell_qa_chat_send_conversation.json`
  - `/tmp/livewell_qa_chat_send_export.txt`

Decisioni

- Non serve riaprire ordering transcript o speaker consistency.
- Serve un follow-up stretto sul cluster filtering: assistant transcript misto payload+testo visibile viene scartato interamente.

Next

- Aprire fix mirato su `sanitizeAssistantVisibleContent()` / `chat/transcript` e ripetere la stessa verifica production.
