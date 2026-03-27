2026-03-27 10:35
Ruolo: backend-developer
Prompt (riassunto): triagiare advisory npm e warning Next, applicare solo fix infra/security a basso rischio e chiudere la track con review critica finale.

Risultato (riassunto)
- triage audit completo con classificazione reachability
- aggiornati `next` e `eslint-config-next` a `16.2.1`, `eslint` a `9.39.4`
- aggiunti overrides sicuri per `gaxios`, `google-auth-library`, `flatted`, `yaml`
- migrato `src/middleware.ts` a `src/proxy.ts`
- aggiunto `turbopack.root` in `next.config.ts`
- audit ridotto da `17` vulnerabilita` (`15 moderate`, `2 high`) a `10` (`9 moderate`, `1 high`)
- i warning Next su `middleware -> proxy` e workspace root multipli non compaiono piu` in build locale o deploy

Evidenze
- `npm audit --json`
- `npm ls next eslint eslint-config-next flatted picomatch yaml gaxios google-auth-library`
- `npm run typecheck`
- `npm run build`
- `npm run test -- tests/api/chat-send-persistence.test.ts tests/api/live-sync-stateSnapshot.test.ts tests/api/live-token-security.test.ts tests/api/case-persistence.test.ts`

Decisioni
- nessun major blind upgrade su `vitest`, `lint-staged`, `eslint@10`, Prisma
- residuo `picomatch/minimatch` accettato come dev-toolchain only

Next
- publish remoto, verifica alias e chiusura finale come `DONE WITH RESIDUAL RECOMMENDATIONS`
