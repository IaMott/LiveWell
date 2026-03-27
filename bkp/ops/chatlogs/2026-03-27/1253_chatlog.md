Timestamp: 2026-03-27 12:53
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto
- La review avversariale finale ha trovato tre track obbligatorie reali: disallineamento tool semantics text/live, boundary canonico permissivo, legacy nel path caldo.
- E` stato aggiunto un nuovo helper condiviso per il routing degli agent tool per-call e panel-aware.
- `chat/send` e `live-sync` usano ora lo stesso criterio di selezione degli agenti tool.
- `persistence.ts` rifiuta snapshot canonici malformed senza riparazione silenziosa via legacy.
- I route hot-path non ricostruiscono piu` `CaseState` quando esiste gia` `stateSnapshot`.
- Sono stati aggiunti test mirati che dimostrano:
  - boundary canonico fail-closed
  - routing tool text multi-agent coerente con il live
- Validazioni locali verdi: lint, typecheck, build e 110 test mirati.

Decisioni prese / next step
- La riduzione del legacy e` stata spinta fino al confine sicuro dei route principali, lasciando il protocol engine interno come residuo controllato.
- Il prossimo passo operativo e` solo publish remoto + verifica production + verdict finale.

Prompt chiave (riassunto)
- Non assumere che il progetto sia chiuso.
- Chiudere davvero le tre track obbligatorie emerse dalla review ostile.
- Continuare in autonomia fino a publish e verdict finale.
