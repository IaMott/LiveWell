# LiveWell — Project Status

## Current Step: Script riusabile smoke autenticato production pronto

## Stato verificato — 2026-03-11 00:34

- Script creato: `scripts/smoke-auth-production.sh`
- Flusso incluso:
  - register/login sessione
  - `/api/chat/send` due turni stessa conversation
  - `/tool user.setAttribute`
  - query verifica DB + cleanup
- Sicurezza:
  - secret obbligatori da env (`SMOKE_PASSWORD`, `DATABASE_URL`)
  - opzionale caricamento da `--env-file`
  - nessuna credenziale hardcoded
- Verifica script: sintassi e help ✅

## Next immediato

- Opzionale: integrare lo script in job CI manuale protetto con secret di ambiente.

## Ultimo aggiornamento

2026-03-11 00:34
