Stato progetto

Obiettivo

Applicare micro-fix stretti al cluster conversazionale reale dei follow-up specialistici già avviati, con focus su continuità del problema attivo, resume con memoria e intake fuori timing.

Fatto

- micro-fix conversazionali applicati in `interviewFlow.ts`, `domainDetection.ts`, `protocol.ts`, `registry.ts`, `synthesis.ts`
- follow-up specialistici stretti ora prioritizzati rispetto a intake L1/L2 quando il problema attivo è già chiaro o viene ripreso da memoria
- corrette deviazioni rumorose su sonno/alimentazione e burnout/career con penalizzazioni di dominio negative
- impedito il return baton prematuro nei consulti legal/financial quando il messaggio resta semanticamente nel consulto attivo
- prompt di synthesis rafforzato per vietare intake generale quando esiste già contesto di caso attivo
- test aggiornati su cluster conversazionale: `53/53` verdi
- guardie di non regressione: `37/37` verdi
- `typecheck` e `build` verdi

In corso

Solo salvataggio memoria operativa del fix e publish remoto finale.

Prossimo

Se richiesto, il passo corretto successivo è una nuova validazione mirata del cluster conversazionale post-fix, non un altro refactor o una campagna ampia.

Rischi

Rischi reali aperti:
- da riverificare sul team reale i dirty cases più densi e i resume specialistici più lunghi
- possibile residuo semantico su reason/ordine delle domande in casi molto ambigui, non ancora rimisurato dopo il fix

Rischi non riaperti:
- queue / `pendingQuestions`
- persistence runtime
- gating strutturato
- artifact governance
- consulti/takeover/handoff già validati
- upload/backend file support di base

Ultimo aggiornamento

2026-03-21 09:16
