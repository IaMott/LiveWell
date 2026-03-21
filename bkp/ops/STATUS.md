Stato progetto

Obiettivo

Chiudere i due finding conversazionali residui post-review sul baseline applicativo `1b64da1`, senza regressioni sui path già forti.

Fatto

- checkpoint Git creato prima delle modifiche su branch `backup/2026-03-21_1015_two-conversation-residuals`
- micro-fix applicati in `domainDetection.ts`, `protocol.ts`, `registry.ts`
- practical separation `mi sto separando, ci sono figli, soldi e problemi pratici da gestire` ora instradata su `coordination` con owner `life-organizer`
- resume sonno `torniamo al sonno, sai già che dormo 5 ore e bevo caffè tardi` ora resta su `sleep-coach`
- test mirati aggiornati in `domain-detection-critical.test.ts`, `case-protocol.test.ts`, `runtime-trigger-guards.test.ts`
- rieseguite 8 suite richieste: `94/94` test verdi
- `typecheck` verde
- `build` verde
- mini harness runtime col team reale eseguito e salvato in `/tmp/livewell_review_conversation_residuals_postfix.json`
- nessuna regressione osservata su:
  - follow-up specialistici già avviati
  - consulti legal/financial attivi
  - persistence / `pendingQuestions`
  - gating strutturato
  - artifact governance

In corso

Salvataggio memoria operativa del fix e publish remoto.

Prossimo

Se richiesto, il passo corretto successivo è una nuova validazione mirata post-fix, non un altro refactor o una campagna ampia.

Rischi

Rischi reali aperti:
- nessun blocco confermato nel perimetro di questi due finding
- da rimisurare solo il comportamento su transcript reali più lunghi post-fix

Rischi non riaperti:
- queue / `pendingQuestions`
- persistence runtime
- gating strutturato
- artifact governance
- consulti/takeover/handoff già validati
- upload/backend file support di base

Ultimo aggiornamento

2026-03-21 09:45
