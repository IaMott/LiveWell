Stato progetto

Obiettivo

Applicare micro-fix mirati ai residui impliciti cross-domain emersi dalla campagna sistemica finale sul baseline applicativo `1a2101d`, migliorando dominio implicito, owner implicito, consulti impliciti residui e dirty cases ad alta entropia senza riaprire il refactor.

Fatto

Micro-fix impliciti cross-domain applicati:
- `src/lib/ai/domain/domainDetection.ts` rafforzato su nutrizione implicita, training implicito, burnout/focus, endocrino, coordination e dirty phrases ad alta entropia
- `src/lib/ai/case/protocol.ts` rafforzato su owner implicito per specialisti health/training/inspiration/coordination, riducendo fallback deboli
- `src/lib/ai/capabilities/registry.ts` rafforzato su consulti impliciti `training pain`, executive burnout, coordination, financial/legal edge cases e reason semantiche
- test aggiornati in `tests/api/domain-detection-critical.test.ts`, `tests/api/runtime-trigger-guards.test.ts`, `tests/api/case-protocol.test.ts`
- verifiche verdi:
  - `53/53` test mirati
  - `18/18` suite di guardia
  - `typecheck` verde
  - `build` verde

In corso

Nessuna modifica applicativa in corso; memoria operativa in aggiornamento e publish remoto del diff applicativo da completare.

Prossimo

Eseguire una nuova validazione mirata post-fix sui cluster impliciti cross-domain e dirty cases, senza riaprire il refactor.

Rischi

Residui da riverificare dopo il fix:
- copertura implicita di alcuni ruoli rari (`endocrinologo`, `chinesiologo`, `medico-dello-sport`, `executive-coach`, `commercialista`) nel team reale
- alcuni dirty cases molto lunghi e multi-tema vanno misurati di nuovo sul runtime completo

Rischi non riaperti:
- queue / `pendingQuestions`
- gating strutturato
- artifact governance
- consulti espliciti
- takeover/handoff già validati
- upload/backend file support di base

Ultimo aggiornamento

2026-03-20 16:07
