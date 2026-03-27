timestamp: 2026-03-27 22:20
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- aperta la track separata "integrazione live/browser meno mock-heavy"
- pre-flight eseguito su STATUS, WORKLOG e DECISIONS
- creato checkpoint Git su branch `backup/2026-03-27-2230_live-integration-guardrails`
- creato backup locale `bkp/backups/2026-03-27/2230_live-integration-guardrails`
- ispezionati `src/app/api/live-token/route.ts`, `src/components/chat/live/LiveModal.tsx` e `src/lib/ai/orchestrator/contextualRouting.ts`
- rilevato gap concreto: assenza di test browser-facing per `LiveModal` e assenza di guardrail puri su `snapshot_context` / `history_context`
- aggiunto test `tests/api/live-modal-bootstrap.test.ts`
- aggiunto test `tests/api/contextual-routing.test.ts`
- suite mirata live verde
- `typecheck`, `lint` e `build` verdi

decisioni prese / next step:
- nessuna modifica runtime: solo guardrail ad alto ROI
- non riaprire transcript/output/speaker
- prossimo passo: commit, push e deploy del commit test-only, poi closeout finale della track
