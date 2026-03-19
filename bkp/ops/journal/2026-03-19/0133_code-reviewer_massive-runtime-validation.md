Timestamp: 2026-03-19 01:33
Ruolo: code-reviewer

Prompt (riassunto)

Eseguire una nuova campagna massiva di simulazioni comportamentali dopo i fix recenti, senza toccare UI o riaprire il refactor generale, con almeno 72 scenari distribuiti su protocollo, consulti, handoff, artifact, dati mancanti, conflitti, recovery, anti-loop e stream semantics.

Risultato (riassunto)

Campagna completata con 73 scenari classificati.
Eseguite 10 suite repository (47 test verdi) e `npm run typecheck` verde.
Usati harness locali con team reale per osservare protocollo, trigger capability, artifact governance e gating.
Confermati miglioramenti reali sui fix B1-B5.
Residui veri emersi:
- trigger consult/handoff con matching testuale troppo permissivo e reason false-positive;
- owner iniziale arbitrario su input generici;
- domain detection insufficiente su alcuni sintomi critici;
- immediate thinking events cosmetici ancora presenti prima dei protocol events.

Evidenze

- `tests/api/case-protocol.test.ts`
- `tests/api/artifact-governance.test.ts`
- `tests/api/team-domain-schema.test.ts`
- `tests/api/orchestrator-synthesis.test.ts`
- `tests/api/chat-send-persistence.test.ts`
- `tests/api/orchestrator-domain-persistence.test.ts`
- `tests/api/orchestrator-interview-flow.test.ts`
- `tests/api/orchestrator-multiround.test.ts`
- `tests/api/orchestrator-tool-call-plan.test.ts`
- `tests/api/orchestrator-consensus-flow.test.ts`
- harness temporanei in `/tmp/livewell_probe_protocol.ts`, `/tmp/livewell_probe_cases.ts`, `/tmp/livewell_probe_handoff.ts`, `/tmp/livewell_probe_misc.ts`

Decisioni

- Nessun refactor generale riaperto.
- La baseline multi-agent resta valida, ma il sistema non va ancora dichiarato pienamente corretto.
- I prossimi fix corretti devono restare mirati su `registry.ts`, `protocol.ts`, `domainDetection.ts` e `route.ts`.

Next

Eventuali micro-fix backend-only sui residui confermati dalla campagna.
