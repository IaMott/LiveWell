Timestamp: 2026-03-19 18:15
Ruolo: backend-developer

Prompt (riassunto)

Applicare micro-fix reali e a basso rischio sui residui emersi dalla campagna comparativa post-fix: regressione `pendingQuestions`, handoff impliciti naturali, consulti impliciti residui `health/legal/inspiration`, gating su `programma/protocollo/report`, senza toccare UI o riaprire il refactor.

Risultato (riassunto)

- Regressione queue chiusa in `interviewFlow.ts`: le queue workspace vengono drenate senza essere reinflazionate da nuove domande L3.
- `protocol.ts` rafforzato con nuovi pattern di continuity naturale per takeover e handoff.
- `registry.ts` migliorato per consult target impliciti e same-domain handoff con owner piu generalisti.
- `synthesis.ts` reso piu uniforme sul gating di richieste strutturate generiche in specialist mode.
- Test mirati aggiornati/aggiunti e verdi.

Evidenze

- `37/37` verdi:
  - `tests/api/orchestrator-domain-persistence.test.ts`
  - `tests/api/case-protocol.test.ts`
  - `tests/api/runtime-trigger-guards.test.ts`
  - `tests/api/orchestrator-synthesis.test.ts`
- `23/23` verdi:
  - `tests/api/artifact-governance.test.ts`
  - `tests/api/chat-send-persistence.test.ts`
  - `tests/api/team-domain-schema.test.ts`
  - `tests/api/domain-detection-critical.test.ts`
- `npm run typecheck` verde
- `npm run build` verde

Decisioni

- Nessun redesign.
- Nessuna modifica UI.
- Nessuna estensione del perimetro oltre i bug runtime reali validati.

Next

- Commit, push e deploy del diff applicativo.
- Nuova validazione mirata post-fix sui residui cross-domain.
