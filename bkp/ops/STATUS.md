Stato progetto

Obiettivo

Applicare micro-fix mirati sui residui emersi dalla validazione massiva: trigger matching troppo permissivo, owner arbitrario su input generici, domain detection critica insufficiente e immediate thinking events cosmetici.

Fatto

Micro-fix applicati:
- `registry.ts`: matcher trigger reso token-aware e piu rigoroso; aggiunti segnali health/mindfulness necessari ai casi reali.
- `protocol.ts`: input `general` ora inizializza un owner neutro (`orchestratore`) invece del primo specialista disponibile; il routing conserva `general` se il current speaker e solo di coordinamento.
- `domainDetection.ts`: dolore toracico, dolore al petto, fiato corto e dispnea rinforzano/forzano `health`.
- `route.ts`: gli immediate thinking events non partono piu su messaggi troppo generici o multi-dominio ambigui.
- test mirati aggiunti o aggiornati.
Verifiche eseguite:
- `npm run test -- tests/api/runtime-trigger-guards.test.ts tests/api/domain-detection-critical.test.ts tests/api/case-protocol.test.ts tests/api/chat-send-persistence.test.ts` -> 25/25 verdi
- `npm run typecheck` -> verde

In corso

Nessuna modifica in corso.

Prossimo

Nessun passo obbligatorio aperto in questo perimetro; eventuali fix successivi solo su residui fuori scope.

Rischi

Nessun rischio nuovo nel perimetro dei quattro micro-fix.
Restano solo residui fuori scope di questo step: ranking del consult target ancora semplice in alcuni domini complessi e presenza deliberata di `activeSpecialist` come compatibilita di output.

Ultimo aggiornamento

2026-03-19 08:25
