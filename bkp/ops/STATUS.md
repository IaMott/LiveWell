Stato progetto

Obiettivo

Verificare in review finale i micro-fix pubblicati nel commit `8ee6da1` su trigger matching, owner neutro per input `general`, detection health critica e stream meno cosmetico.

Fatto

Review finale del commit `8ee6da1` completata:
- `registry.ts`: trigger matching piu rigoroso confermato nel path runtime e nei test mirati.
- `protocol.ts`: owner neutro per input `general` confermato; niente assegnazione arbitraria del primo specialista.
- `domainDetection.ts`: red flag health critiche confermate con priorita su `health`.
- `route.ts`: immediate thinking events soppressi nei casi generici o multi-dominio ambigui.
- test mirati rieseguiti con esito verde.
Verifiche eseguite:
- `npm run test -- tests/api/runtime-trigger-guards.test.ts tests/api/domain-detection-critical.test.ts tests/api/case-protocol.test.ts tests/api/chat-send-persistence.test.ts` -> 25/25 verdi
- `npm run typecheck` -> verde

In corso

Nessuna modifica in corso.

Prossimo

Nessun passo obbligatorio aperto in questo perimetro; eventuali step successivi solo su review o fix fuori scope.

Rischi

Nessun finding nuovo o bloccante nel perimetro verificato.
Restano solo residui fuori scope di questo step: ranking del consult target ancora semplice in alcuni domini complessi e presenza deliberata di `activeSpecialist` come compatibilita di output.

Ultimo aggiornamento

2026-03-19 09:19
