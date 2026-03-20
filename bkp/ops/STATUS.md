Stato progetto

Obiettivo

Chiudere l'ultimo residuo same-domain confermato dalla review del commit `f8093cb`: promuovere a `handoff_pending_user` i phrasing forti di ownership stabile come `vorrei che fosse lui a seguirmi da ora`, senza regressioni sui takeover morbidi e sui path già forti.

Fatto

Micro-fix finale sul phrasing forte di handoff completato:
- modificato solo `src/lib/ai/case/protocol.ts`
- aggiunti test mirati in `tests/api/case-protocol.test.ts`
- `vorrei che fosse lui a seguirmi da ora` ora apre `handoff_pending_user`
- phrasing equivalente `vorrei continuare con lui come riferimento principale` ora apre `handoff_pending_user`
- `parliamo ancora di questo con lui`, `restiamo su questa parte` e `proseguiamo con lui` restano `consult_active_takeover`
- `ok`, `grazie`, `capito` continuano a tornare all'owner
- test mirati verdi: `39/39`
- suite di guardia verdi: `24/24`
- `typecheck` e `build` verdi
- commit/push/deploy in corso di finalizzazione

In corso

Nessuna modifica applicativa aggiuntiva in corso; il fix è completato e validato localmente.

Prossimo

Nuova validazione mirata post-fix sul team reale del commit che contiene questo ultimo micro-fix.

Rischi

Nessun residuo confermato nel perimetro di questo phrasing fix; resta solo da verificare il comportamento runtime con review mirata post-publish.

Ultimo aggiornamento

2026-03-20 12:42
