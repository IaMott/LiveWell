Stato progetto

Obiettivo

Validare in modo mirato e severo il commit applicativo `67db453` sui cluster residui impliciti: monodominio implicito cross-domain, consulti impliciti residui, dirty cases rappresentativi e non-regressioni su persistence/gating/artifact governance.

Fatto

Validazione mirata del commit `67db453` completata:
- verificato che `HEAD` coincide con il baseline applicativo `67db453`
- inspection di `src/lib/ai/domain/domainDetection.ts`, `src/lib/ai/case/protocol.ts`, `src/lib/ai/capabilities/registry.ts`
- `53/53` test dichiarati verdi
- `18/18` guardie verdi
- mini harness runtime con team reale eseguito e rimosso
- miglioramenti reali confermati su:
  - owner implicito nutrition / gastro / burnout / coordination / training pain
  - consulti impliciti `training pain`, `executive burnout`, `coordination overload`, `legal`, `debt+ansia`
- residui reali trovati:
  - `mi sto separando e ci sono problemi pratici` -> owner `career-coach` troppo debole
  - dirty cases ad alta entropia ancora solo parzialmente credibili su target e reason
  - alcune reason restano semanticamente scorrelate dal target effettivo nel team reale

In corso

Nessuna modifica applicativa in corso; memoria operativa della review da pubblicare.

Prossimo

Se richiesto, il passo corretto successivo è un altro micro-fix stretto su practical separation e su alcune reason/target dei dirty cases, non una campagna più ampia.

Rischi

Residui confermati dalla review:
- owner implicito ancora debole su practical separation senza segnale legal forte
- dirty cases multi-tema ancora parziali su reasoning/target nei casi con lavoro+ansia+organizzazione e separazione+figli+soldi
- fallback/trigger di capabilities nel team reale ancora talvolta producono reason semanticamente deboli

Rischi non riaperti:
- queue / `pendingQuestions`
- gating strutturato
- artifact governance
- consulti espliciti
- takeover/handoff già validati
- upload/backend file support di base

Ultimo aggiornamento

2026-03-20 16:35
