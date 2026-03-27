timestamp: 2026-03-27 22:20
ruolo: backend-developer
prompt: Aprire solo la track separata "integrazione live/browser meno mock-heavy" e rafforzare i boundary `live-token` / bootstrap / browser-facing senza redesign.

risultato:
- creato checkpoint Git `backup/2026-03-27-2230_live-integration-guardrails` e backup locale `bkp/backups/2026-03-27/2230_live-integration-guardrails`
- aggiunto `tests/api/live-modal-bootstrap.test.ts` sul boundary reale `LiveModal -> /api/live-token -> GoogleGenAI.live.connect`
- aggiunto `tests/api/contextual-routing.test.ts` sui source `snapshot_context` e `history_context`
- nessuna modifica runtime applicativa: solo hardening dei guardrail
- validazioni verdi: suite live mirata, `npm run typecheck`, `npm run lint`, `npm run build`

evidenze:
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/live-modal-bootstrap.test.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/tests/api/contextual-routing.test.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/components/chat/live/LiveModal.tsx`
- `/Users/mattiamottisi/Desktop/LiveWell/src/app/api/live-token/route.ts`
- `/Users/mattiamottisi/Desktop/LiveWell/src/lib/ai/orchestrator/contextualRouting.ts`

decisioni:
- rafforzare il perimetro live solo con test/integration guardrail ad alto ROI
- non toccare transcript/output/speaker
- non aprire redesign di route, SDK o protocol engine

next:
- commit, push e deploy del commit test-only
- chiudere la track con residual recommendations fuori scope
