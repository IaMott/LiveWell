Stato progetto

Obiettivo

Eseguire una validazione mirata e severa del comportamento conversazionale su casi specialistici già avviati, con focus su continuità del problema attivo, intake fuori timing e credibilità dei follow-up.

Fatto

- review conversazionale mirata completata su 30 scenari multi-turno / specialistici
- eseguite 8 suite repository (`75/75` test verdi) come guardie su protocollo/interview/synthesis/persistence/runtime triggers
- harness temporaneo eseguito sul team reale e rimosso; output strutturato scritto in `/tmp/livewell_conversation_focus_audit.json`
- verdetto principale:
  - protocollo tecnico regge
  - continuità conversazionale regge solo parzialmente
  - intake baseline / goal generici ricompaiono troppo spesso anche quando il caso è già attivo
- pattern peggiori osservati:
  - ritorno a domande “dati fondamentali” in casi specialistici già aperti
  - cambio dominio/consulto non credibile su burnout, sonno, finanza e separazione pratica
  - consulti attivi che ricadono su domande generiche o addirittura tornano all’owner sbagliato

In corso

Solo salvataggio memoria operativa della review; nessuna modifica applicativa in corso.

Prossimo

Se richiesto, il passo corretto successivo è un micro-fix stretto sui moduli del cluster conversazionale (`interviewFlow.ts`, `domainDetection.ts`, `registry.ts`, `protocol.ts`, `synthesis.ts`), non un refactor generale.

Rischi

Rischi reali aperti:
- intake generico fuori timing nei follow-up specialistici
- perdita del focus attivo su burnout/sonno/finanza/separazione pratica
- consulti specialistici che ricadono nel generico o passano allo specialista sbagliato
- uso ancora troppo debole della memoria conversazionale in alcuni resume specialistici

Rischi non riaperti:
- queue / `pendingQuestions`
- persistence runtime
- gating strutturato
- artifact governance
- consulti/takeover/handoff già validati
- upload/backend file support di base

Ultimo aggiornamento

2026-03-20 22:01
