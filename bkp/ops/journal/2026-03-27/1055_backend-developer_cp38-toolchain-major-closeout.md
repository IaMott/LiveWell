timestamp: 2026-03-27 10:55
ruolo: backend-developer
prompt: Chiudere una track autonoma di major toolchain upgrade + dependency hygiene, con triage reale delle advisory residue, validazione completa e review critica finale senza riaprire il runtime shared text/live.

risultato:
- aggiornati `lint-staged` a `16.4.0` e `vitest` a `4.1.2`
- aggiunto override `picomatch@4.0.4`
- lockfile riallineato
- adattati i test `live-token` al nuovo modello di mock/import di `vitest@4`
- audit ridotto a `9 moderate / 0 high`
- build, lint, typecheck e suite runtime/security mirata verdi

evidenze:
- package.json
- package-lock.json
- tests/api/live-token-security.test.ts
- tests/api/live-token-fallback-observability.test.ts
- bkp/backups/2026-03-27/1040_cp37-toolchain-major
- bkp/backups/2026-03-27/1052_cp38-vitest4-test-fix

decisioni:
- tenere `vitest@4` per ROI favorevole dopo fix test-only
- non forzare `eslint@10` o `prisma@7` in questa track

next:
- commit mirato
- push su `origin/main`
- deploy Vercel production
- verifica post-deploy e review finale della track
