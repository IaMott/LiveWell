Timestamp: 2026-03-19 01:17
Ruolo: backend-developer
Prompt (riassunto): applicare solo il micro-fix residuo su B4 in `src/lib/ai/artifacts/contracts.ts`, senza toccare altri moduli.

Risultato (riassunto):
- Corretta l'ultima istruzione di `buildProfessionalOutputInstructions()`.
- Rimossa la formula permissiva sulle assunzioni ragionevoli con dati mancanti.
- Sostituita con una regola coerente col gating prudente: chiedere dati mancanti o fornire solo struttura preliminare incompleta.
- Rafforzato il test di synthesis gia esistente per verificare anche questa coerenza.

Evidenze:
- `src/lib/ai/artifacts/contracts.ts`
- `tests/api/orchestrator-synthesis.test.ts`

Decisioni:
- Nessun refactor aggiuntivo.
- Nessun cambio UI.
- Nessun tocco a `synthesis.ts`, `protocol.ts`, `route.ts` o `governance.ts`.

Next:
- Commit, push e deploy del micro-fix B4.
