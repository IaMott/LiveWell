Stato progetto

Obiettivo

Eseguire una campagna sistemica di validazione comportamentale dell'intero sistema multi-agente gia rifattorizzato e pubblicato, coprendo tutti i professionisti reali del team, i domini runtime, la collaborazione multi-dominio, memoria/profilo/altre chat, artifact, gating e allegati.

Fatto

Campagna sistemica completata:
- 24 professionisti reali ricostruiti dal repository (`TEAM/**/profile.json`, loader e contracts runtime)
- 230 scenari complessivi classificati
- esito complessivo: 149 PASS, 70 FAIL, 11 PARTIAL, 0 NON VERIFICABILI
- saluti/input generici: stabili e senza owner arbitrario
- monodominio esplicito: stabile su tutti i professionisti coperti
- artifact governance: buona nei casi testati, con un residuo reale su `gastroenterologo -> nutrition`
- memoria/profilo/tool persistence: buona nei casi testati
- allegati/immagini: pipeline osservabile e coerente nei path backend verificati
- triage implicito, consulti impliciti, takeover e handoff: ancora la parte piu fragile del sistema
Verifiche eseguite:
- `npm run test -- tests/api/case-protocol.test.ts tests/api/artifact-governance.test.ts tests/api/team-domain-schema.test.ts tests/api/orchestrator-synthesis.test.ts tests/api/chat-send-persistence.test.ts tests/api/orchestrator-domain-persistence.test.ts tests/api/orchestrator-interview-flow.test.ts tests/api/orchestrator-multiround.test.ts tests/api/orchestrator-tool-call-plan.test.ts tests/api/orchestrator-consensus-flow.test.ts tests/api/domain-detection-critical.test.ts tests/api/runtime-trigger-guards.test.ts` -> 55/55 verdi
- `npm run test -- tests/api/context-pack-builder.test.ts tests/api/orchestrator-domain-persistence.test.ts tests/api/orchestrator-tool-call-plan.test.ts tests/api/user-set-attribute-smoke.test.ts tests/api/domain-canonical-write-read.e2e.test.ts` -> 16/16 verdi
- `npm run typecheck` -> verde

In corso

Nessuna modifica in corso.

Prossimo

Eventuali micro-fix successivi solo su residui emersi dalla validazione sistemica:
- triage implicito su domini naturali (`nutrition`, `health`, `inspiration`)
- ranking del consult target implicito
- takeover/return baton su formule conversazionali naturali
- handoff impliciti troppo deboli
- gating non uniforme su alcune richieste strutturate (`scheda`, `protocollo`, `strategia`, `valutazione`)

Rischi

Il sistema non puo ancora essere dichiarato corretto nei casi testati:
- triage implicito ancora troppo euristico su piu domini reali
- consulti impliciti spesso aperti verso target poco coerenti o non aperti affatto
- takeover temporanei fragili su formule naturali tipo `parlare ancora con`
- handoff impliciti molto deboli salvo pochi casi espliciti ben guidati
- alcuni casi critici health vengono ancora agganciati a target semanticamente sbagliati
- la copertura professionale e ampia ma non ancora credibile in modo uniforme su tutti i ruoli del team

Ultimo aggiornamento

2026-03-19 10:40
