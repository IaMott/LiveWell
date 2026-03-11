# LiveWell — Project Status

## Current Step: Queue domande cross-turn + verifica no template runtime

## Stato verificato — 2026-03-11 14:36

- Fix applicati su backend:
  - fallback anti-500 in `chat/send`,
  - inferenza/persistenza multi-dominio in orchestrator,
  - normalizzazione/ dedup `user.setAttribute`,
  - endpoint export DB dinamico `/api/profile/dynamic-db`,
  - specialist mode più coerente con dominio professionista.
- Test mirati PASS: `13/13`.
- Deploy production eseguito e smoke multi-dominio rerun:
  - report: `/tmp/livewell_domains_report_1773236007.json`
  - miglioramenti confermati:
    - `allenamento`: turn1 500 risolto
    - `mindfulness` e `idee`: persistenza ora presente
    - check fisioterapista: niente domanda “quale area vuoi prioritizzare”
- Gap residui:
  - `nutrizione`: persistenza non stabile in tutti i run
  - `salute`: varianti key ancora eterogenee in alcuni casi

## Next immediato

- Commit/push/deploy dei fix strutturali globali + queue domande cross-turn.
- Smoke production su persistenza domande residue (turni successivi) e assenza template runtime.

## Ultimo aggiornamento

2026-03-11 15:35
