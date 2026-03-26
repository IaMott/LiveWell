2026-03-26 23:07
Ruolo: backend-developer

Prompt (riassunto)
- Procedere solo col primo fix warning residuo della pipeline
- Toccare solo `.github/workflows/ci.yml` e `bkp/ops/*`
- Eliminare il warning di deprecazione Node 20 in GitHub Actions senza toccare altri warning

Risultato (riassunto)
- Workflow CI aggiornato con bump minimo da `actions/checkout@v4` a `@v5`
- Workflow CI aggiornato con bump minimo da `actions/setup-node@v4` a `@v5`
- Nessun altro step del job modificato
- Validazione minima locale verde su diff e formatting del workflow

Evidenze
- `.github/workflows/ci.yml`
- `git diff --check HEAD -- .github/workflows/ci.yml`
- `npx prettier --check .github/workflows/ci.yml`
- `bkp/backups/2026-03-26/2300_ci-node24-warning`

Decisioni
- Il warning riguarda il runtime interno delle action, non il `node-version` del progetto
- Fix minimo scelto: bump action major-only, nessun altro cambio CI

Next
- Commit del workflow
- Push su `main`
- Verifica del nuovo run GitHub Actions
