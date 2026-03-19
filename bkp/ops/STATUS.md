Stato progetto

Obiettivo

Applicare micro-fix cross-domain minimi sui residui emersi dalla campagna sistemica da 230 scenari, senza riaprire il refactor generale: triage implicito, consult target impliciti, takeover naturale, handoff impliciti, gating strutturato e residuo artifact ibrido.

Fatto

Micro-fix cross-domain applicati e verificati:
- `domainDetection.ts` rafforzato su linguaggio naturale implicito per `nutrition`, `training`, `mindfulness`, `inspiration`, `health`
- `registry.ts` migliorato con ranking consult target piu coerente, matching trigger meno letterale e supporto artifact piu preciso per ruoli ibridi
- `protocol.ts` corretto su continuita naturale del consultato, return baton non prematuro e handoff impliciti piu robusti
- `compat.ts` aggiornato per trattare owner specialistici impliciti come `activeSpecialist` backend-side
- `synthesis.ts` uniformato sul gating per richieste strutturate (`scheda`, `programma`, `protocollo`, `strategia`, `valutazione`, `report`, `menu`, `percorso`)
- residuo `gastroenterologo -> nutrition` corretto senza allargare l'artifact engine
Verifiche eseguite:
- `npm run test -- tests/api/domain-detection-critical.test.ts tests/api/runtime-trigger-guards.test.ts tests/api/case-protocol.test.ts tests/api/orchestrator-synthesis.test.ts tests/api/artifact-governance.test.ts` -> 34/34 verdi
- `npm run typecheck` -> verde
- `npm run build` -> verde

In corso

Nessuna modifica in corso; step chiuso localmente e pronto per publish remoto.

Prossimo

Review finale del commit dei micro-fix cross-domain oppure nuova validazione comportamentale mirata sui casi impliciti reali post-fix.

Rischi

Il sistema resta da rivalidare su larga scala dopo questi fix:
- il triage implicito e piu forte ma va misurato di nuovo su campagne sistemiche, non solo su suite mirate
- consult target e handoff impliciti sono migliorati, ma i casi sporchi molto lunghi possono ancora avere edge case
- build segnala il warning noto di root Next.js con lockfile multipli, non bloccante per questo task

Ultimo aggiornamento

2026-03-19 12:13
