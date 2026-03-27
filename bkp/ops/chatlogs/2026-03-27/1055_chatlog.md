timestamp: 2026-03-27 10:55
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- Avviata la track `major toolchain upgrade + dependency hygiene`.
- Triage reale delle residue con `npm audit --json`, `npm ls` e `npm view`.
- Classificato `lint-staged` come major a ROI alto per rimuovere il ramo `picomatch` high.
- Classificato `vitest` come major sensato ma da verificare per regressioni nei mock.
- Aggiornato `package.json` a `lint-staged@16.4.0`, `vitest@4.1.2`, override `picomatch@4.0.4`.
- `npm install` ha ridotto l'audit a `9 moderate / 0 high`.
- Emersa una regressione test-only su `tests/api/live-token-security.test.ts` dovuta a compatibilita` mock/import con `vitest@4`.
- Fix test-only applicato:
  - prisma mock esplicito
  - lazy import del route dopo i mock
  - constructor-style mock per `@google/genai`
- Validazioni verdi:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - test live-token mirati
  - test runtime shared/security mirati
  - audit finale senza `high`

decisioni / next:
- Tenere `vitest@4` e non fare rollback del major.
- Accettare come residuo solo la stack `eslint`/`minimatch` moderate.
- Prossimo passo operativo: commit, push, deploy, verifica remota e chiusura finale della track.
