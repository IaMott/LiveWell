Stato progetto

Obiettivo

Chiudere il fail CI reale su `tests/api/interview-flow-transcript-2026-03-11.test.ts` e pulire i warning lint localizzati senza riaprire runtime o UI fuori scope.

Fatto

- verificato che il fail CI (`expected 3 to be less than or equal to 1`) deriva da un test non più allineato al runtime attuale
- confermato in `interviewFlow.ts` che il batching fino a 3 domande baseline L1 è intenzionale e già documentato nel codice vivo
- aggiornato `tests/api/interview-flow-transcript-2026-03-11.test.ts` per accettare fino a 3 domande baseline mirate e continuare a bloccare follow-up generici
- puliti i warning lint localizzati in:
  - `src/lib/tools/handlers.ts`
  - `src/lib/cache/contextCache.ts`
  - `src/components/profile/sections/NutritionSection.tsx`
  - `src/components/profile/ProfileNav.tsx`
- verifiche eseguite con esito verde:
  - `tests/api/interview-flow-transcript-2026-03-11.test.ts`
  - `tests/api/orchestrator-interview-flow.test.ts`
  - `tests/api/orchestrator-domain-persistence.test.ts`
  - `tests/api/orchestrator-synthesis.test.ts`
  - `tests/api/artifact-governance.test.ts`
  - `tests/api/chat-send-persistence.test.ts`
  - targeted eslint sui file warning
  - `npm run typecheck`

In corso

Publish remoto del fix CI/lint e verifica post-deploy.

Prossimo

Se il publish va a buon fine, nessun altro fix immediato su questo cluster; il passo successivo corretto è una nuova validazione mirata solo se emergono altri fail reali da CI o review.

Rischi

Rischio residuo basso:
- il test transcript continua a non estrarre attributi anagrafici dai `recentMessages`; al momento è coerente con il runtime vivo e non è il bug di questo step
- warning lint locali chiusi senza impatto comportamentale

Rischi non riaperti:
- queue / `pendingQuestions`
- persistence runtime
- gating strutturato
- artifact governance
- consulti/takeover/handoff già validati
- upload/backend file support di base

Ultimo aggiornamento

2026-03-20 17:50
