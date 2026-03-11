# Journal Entry

- Timestamp: 2026-03-11 13:15
- Ruolo: backend-developer
- Prompt (riassunto): hardening interview-flow backend per sostituire domande generiche con domande mirate e aggiungere test su transcript reale 11/03/2026.

## Risultato (riassunto)
- Implementato hardening nel layer orchestrator con:
  - filtro domande generiche
  - generazione domande critiche per dominio/campi mancanti
  - merge con gating consensus e dedup
  - enforcement nel testo finale anche in caso di output LLM debole
- Aggiunto test nuovo su transcript reale (`interview-flow-transcript-2026-03-11`).
- Primo run test fallito su variante lessicale generica "desideri aggiungere"; fixato pattern e rerun verde.

## Evidenze
- src/lib/ai/orchestrator/orchestrator.ts
- tests/api/interview-flow-transcript-2026-03-11.test.ts
- comando test: npm run test -- tests/api/interview-flow-transcript-2026-03-11.test.ts tests/api/orchestrator-dob-fallback.test.ts tests/api/chat-send-persistence.test.ts

## Decisioni
- Non affidare al solo prompt la qualità dell'intervista: aggiunto enforcement deterministico lato orchestrator.
- Non limitare ad una domanda singola quando mancano campi clinici/pratici critici.

## Next
- attendo conferma utente per blocco successivo (smoke prod e/o commit/push/deploy).
