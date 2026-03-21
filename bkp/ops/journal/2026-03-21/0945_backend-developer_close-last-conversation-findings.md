2026-03-21 09:45
Ruolo: backend-developer

Prompt (riassunto)
- Chiudere solo i due finding residui post-review sul commit applicativo `1b64da1`.
- Evitare `career-coach` su practical separation con figli/soldi/problemi pratici.
- Mantenere il resume sonno con memoria su `sleep/mindfulness`, senza drift a `relationship`.
- Nessuna regressione su persistence, gating, artifact governance e path conversazionali già forti.

Risultato (riassunto)
- Patch minime applicate in `src/lib/ai/domain/domainDetection.ts`, `src/lib/ai/case/protocol.ts`, `src/lib/ai/capabilities/registry.ts`.
- Practical separation ora rilevato come `coordination` e assegnato a `life-organizer`.
- Resume sonno con caffeina/ore di sonno resta su `sleep-coach` senza consulto extra.
- Test aggiornati in `tests/api/domain-detection-critical.test.ts`, `tests/api/case-protocol.test.ts`, `tests/api/runtime-trigger-guards.test.ts`.
- Suite richieste verdi (`94/94`), `typecheck` verde, `build` verde.
- Harness runtime col team reale positivo; output in `/tmp/livewell_review_conversation_residuals_postfix.json`.

Evidenze
- `src/lib/ai/domain/domainDetection.ts`
- `src/lib/ai/case/protocol.ts`
- `src/lib/ai/capabilities/registry.ts`
- `tests/api/domain-detection-critical.test.ts`
- `tests/api/case-protocol.test.ts`
- `tests/api/runtime-trigger-guards.test.ts`
- `/tmp/livewell_review_conversation_residuals_postfix.json`

Decisioni
- Fix confinato a detection/owner scoring/consult ranking.
- Nessun intervento su UI, `ChatContext.tsx`, `CaseState`, persistence, gating, artifact governance.

Next
- Commit, push, deploy e nuova validazione mirata post-fix.
