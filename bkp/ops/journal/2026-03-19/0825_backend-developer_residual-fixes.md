Timestamp: 2026-03-19 08:25
Ruolo: backend-developer

Prompt (riassunto)

Applicare solo quattro micro-fix post-validazione: matcher trigger piu rigoroso, owner neutro su input generici, domain detection health critica rafforzata e riduzione degli immediate thinking events cosmetici.

Risultato (riassunto)

Fix applicati con perimetro ristretto:
- `src/lib/ai/capabilities/registry.ts`
- `src/lib/ai/case/protocol.ts`
- `src/lib/ai/domain/domainDetection.ts`
- `src/app/api/chat/send/route.ts`

Test aggiunti/aggiornati:
- `tests/api/runtime-trigger-guards.test.ts`
- `tests/api/domain-detection-critical.test.ts`
- `tests/api/case-protocol.test.ts`
- `tests/api/chat-send-persistence.test.ts`

Verifiche:
- 25/25 test mirati verdi
- `npm run typecheck` verde

Evidenze

- trigger false-positive OSAS eliminato dai reason generici di burnout/ansia;
- `ciao` e messaggi `general` non assegnano piu il primo specialista del team;
- `dolore toracico`, `fiato corto`, `dispnea` convergono su `health`;
- niente immediate thinking events nei casi multi-dominio ambigui senza evidenza di protocollo.

Decisioni

- Nessun refactor generale riaperto.
- Nessuna modifica UI.
- Nessun intervento su artifact governance o prompt team oltre il necessario.

Next

Nessun passo obbligatorio aperto nel perimetro di questi fix.
