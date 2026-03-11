# LiveWell — Project Status

## Current Step: Micro-fix specialist lock + anti-output inconcludente + thinking trace

## Stato verificato — 2026-03-11 16:46

- Fix applicati su backend:
  - persistenza lock specialista cross-pagina in `useChat` (localStorage + restore stato),
  - fallback safe non inconcludente in `chat/send` (domanda/risposta pratica per dominio),
  - stream SSE con evento `agent.thinking` (nome specialista + titolo ragionamento),
  - UI thinking aggiornata con switch visuale agente e titolo.
- Database: reset completo eseguito via `prisma db push --force-reset` su datasource configurato.
- Test mirati PASS: `14/14` (chat-send persistence + orchestrator + transcript).
- Smoke production rapido:
  - lock specialista confermato su 2 turni (`activeSpecialistId=fisioterapista`),
  - fallback tecnico assente.
  - eventi `agent.thinking` confermati (3 eventi/turno nello smoke post-deploy).
  - titolo ragionamento ulteriormente normalizzato (senza prefissi `domain/summary`).

## Next immediato

- Commit/push/deploy di questo step.
- Verifica production post-deploy su stream `agent.thinking` e persistenza lock specialista dopo passaggio chat→profilo→chat.

## Ultimo aggiornamento

2026-03-11 16:46
