2026-03-26 23:07
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto
- L'utente ha chiesto di correggere solo il warning residuo di deprecazione Node 20 in GitHub Actions.
- Review precedente aveva classificato questo warning come priorita alta tra i residui CI non bloccanti.
- Il workflow CI usava `actions/checkout@v4` e `actions/setup-node@v4`.
- Il warning del run indicava che quelle action girano su runtime Node 20 deprecato.
- Applicato il fix minimo: bump a `@v5` per entrambe.
- Nessuna modifica a `node-version: '20'`.
- Nessuna modifica a runtime applicativo, UI o test.
- Validazione locale minima verde.

Decisioni prese / next step
- Decisione: trattare il problema come warning infra delle action runtime, non come upgrade del Node del progetto.
- Next: commit, push e verifica del nuovo workflow CI.

Prompt chiave (riassunti)
- "Procedi solo col primo fix warning residuo"
- "Tocca solo .github/workflows/ci.yml e bkp/ops/*"
