Timestamp: 2026-03-19 01:01
Ruolo: backend-developer
Prompt (riassunto): correggere solo i bug B1-B5 del runtime multi-agent senza toccare UI o riaprire il refactor generale.

Risultato (riassunto):
- Integrati `consultTriggers` e `handoffTriggers` nel protocollo runtime per consulti e handoff capability-aware.
- Ristretta l'autorizzazione artifact ai domini dichiarati e ai tool effettivamente coerenti.
- Bloccati artifact con prerequisiti minimi mancanti usando `medicalRecord.missingKeys` come gate equivalente.
- Resa piu prudente la synthesis quando l'utente chiede un piano ma mancano dati critici.
- Reso lo stream piu protocol-first: se esistono eventi di protocollo reali, quelli proposal-based non guidano piu la semantica dello stream.

Evidenze:
- `src/lib/ai/case/protocol.ts`
- `src/lib/ai/capabilities/registry.ts`
- `src/lib/ai/capabilities/contracts.ts`
- `src/lib/ai/artifacts/governance.ts`
- `src/lib/ai/artifacts/contracts.ts`
- `src/lib/ai/orchestrator/synthesis.ts`
- `src/app/api/chat/send/route.ts`
- `tests/api/case-protocol.test.ts`
- `tests/api/artifact-governance.test.ts`
- `tests/api/team-domain-schema.test.ts`
- `tests/api/orchestrator-synthesis.test.ts`
- `tests/api/chat-send-persistence.test.ts`

Decisioni:
- Usare i capability contracts come gate reale nel protocollo solo quando configurati, con fallback compatibile dove i contract non esistono.
- Stringere la governance artifact sull'intersezione tra dominio reale dello specialista, contract runtime e prerequisiti minimi del contesto.

Next:
- Commit, push e deploy del fix backend.
