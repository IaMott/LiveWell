Timestamp: 2026-03-20 17:50
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto

- richiesto fix sul fail CI reale in `tests/api/interview-flow-transcript-2026-03-11.test.ts`
- riprodotto il fail: `expected 3 to be less than or equal to 1`
- inspection di `interviewFlow.ts` e `inputInference.ts`
- confermato che il runtime batcha intenzionalmente fino a 3 domande baseline L1
- conclusione: fail dovuto a test obsoleto, non a regressione runtime
- aggiornato il test per accettare 1..3 domande mirate e bloccare follow-up generici
- puliti warning lint in `handlers.ts`, `contextCache.ts`, `NutritionSection.tsx`, `ProfileNav.tsx`
- rieseguiti con esito verde:
  - test transcript bloccante
  - suite adiacenti interview/persistence/synthesis/artifact governance/chat-send persistence
  - targeted eslint sui file warning
  - `npm run typecheck`

Decisioni prese / next step

- non toccare `interviewFlow.ts`: il runtime attuale è coerente con il design
- pubblicare il fix con commit/push/deploy e verificare rapidamente il deploy

Prompt chiave (riassunto)

Capire se il fail CI fosse test vecchio o regressione reale; correggere nel modo minimo corretto; pulire warning lint locali fuori dal perimetro UI/architettura.
