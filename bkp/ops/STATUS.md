Stato progetto

Obiettivo

Chiudere con micro-fix mirati i residui emersi dalla campagna comparativa post-fix: regressione `pendingQuestions`, handoff impliciti, consulti impliciti residui `health/legal/inspiration`, gating strutturato e alcuni casi sporchi a basso rischio.

Fatto

Micro-fix backend applicati e verificati:
- `interviewFlow.ts` corretto per drenare deterministicamente la queue workspace senza reinflazionare `pendingQuestions`
- `protocol.ts` rafforzato sui phrasing naturali di continuity/takeover/handoff
- `registry.ts` migliorato su consult target impliciti `health`, `legal`, `inspiration` e same-domain handoff da owner piu generalisti
- `synthesis.ts` uniformato meglio sul gating strutturato per `programma`, `protocollo`, `report`
- test mirati aggiunti/aggiornati su queue regression, handoff naturale positivo/negativo, consulti impliciti residui e gating strutturato
Verifiche eseguite:
- `npm run test -- tests/api/orchestrator-domain-persistence.test.ts tests/api/case-protocol.test.ts tests/api/runtime-trigger-guards.test.ts tests/api/orchestrator-synthesis.test.ts` -> 37/37 verdi
- `npm run test -- tests/api/artifact-governance.test.ts tests/api/chat-send-persistence.test.ts tests/api/team-domain-schema.test.ts tests/api/domain-detection-critical.test.ts` -> 23/23 verdi
- `npm run typecheck` -> verde
- `npm run build` -> verde

In corso

Nessuna modifica applicativa in corso; step chiuso localmente e pronto per publish remoto.

Prossimo

Nuova campagna di validazione mirata post-fix sui residui cross-domain, non un nuovo refactor.

Rischi

Residui ancora da rivalidare dopo il fix:
- casi sporchi/lunghi/multi-tema possono ancora avere edge case semantici
- handoff impliciti migliorati, ma vanno misurati di nuovo su campagna comparativa
- warning noto Next.js sui lockfile multipli resta non bloccante

Ultimo aggiornamento

2026-03-19 18:15
