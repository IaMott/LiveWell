# LiveWell — Project Status

## Current Step: Hardening backend interview-flow (domande mirate)

## Stato verificato — 2026-03-11 13:15

- Hardening applicato in `src/lib/ai/orchestrator/orchestrator.ts`:
  - filtro domande generiche
  - motore domande critiche per dominio/campi mancanti
  - enforcement testo finale con elenco numerato obbligatorio delle domande critiche mancanti
- Test transcript reale aggiunto: `tests/api/interview-flow-transcript-2026-03-11.test.ts`.
- Suite mirata verde:
  - `tests/api/interview-flow-transcript-2026-03-11.test.ts`
  - `tests/api/orchestrator-dob-fallback.test.ts`
  - `tests/api/chat-send-persistence.test.ts`

## Next immediato

- Eseguire smoke autenticato su production del nuovo interview-flow e verificare persistenza su DB dinamico.
- Se confermato, commit/push/deploy backend-only.

## Ultimo aggiornamento

2026-03-11 13:15
