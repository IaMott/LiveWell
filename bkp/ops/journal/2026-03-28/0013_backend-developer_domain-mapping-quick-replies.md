Timestamp: 2026-03-28 00:13
Ruolo: backend-developer
Prompt (riassunto): chiudere i bug di prodotto piu` affidabili da correggere nel turno corrente senza fermarsi all'analisi; focus operativo su mapping canonico agente→dominio e quick replies contestuali incoerenti.

Risultato (riassunto):
- introdotto `src/lib/ai/team/domainMapping.ts` come single source of truth del dominio runtime/visuale degli agenti
- esteso `AgentProfile`/loader/schema con `primaryDomain`
- dichiarato `sleep-coach.primaryDomain = mindfulness`
- riallineati i path production-facing (`chat/send`, `chatStream`, `case/*`, `consensus/domainResolver`, `agentExecution`) per evitare il fallback ambiguo a `domainTags[0]`
- reso `contextualQuickReplies` piu` conservativo: ultima domanda utile, deduplica, fail-closed sulle domande composte
- aggiunti guardrail dedicati su domain mapping e quick replies

Evidenze:
- codice: `src/lib/ai/team/domainMapping.ts`, `src/app/api/chat/send/route.ts`, `src/app/api/chat/send/chatStream.ts`, `src/lib/ai/case/{compat,events,protocol}.ts`, `src/lib/ai/consensus/domainResolver.ts`, `src/lib/ai/orchestrator/{agentExecution,contextualQuickReplies}.ts`
- profilo team: `TEAM/allenamento/coach-del-sonno/profile.json`
- test: `tests/api/agent-domain-mapping.test.ts`, `tests/api/contextual-quick-replies.test.ts`, `tests/api/chat-send-persistence.test.ts`
- validazioni: 27 test mirati PASS, 76 test di confine PASS, `npm run typecheck` PASS, `npm run lint` PASS, `npm run build` PASS
- backup locale: `bkp/backups/2026-03-28/0008_product-reliability-pre`

Decisioni:
- non riaprire il progetto con redesign larghi: fix minimo corretto = mapping canonico condiviso + quick replies fail-closed se ambigue
- mantenere il verdetto finale severo: i bug corretti in questo turno non chiudono ancora il gap di prodotto su multi-caso/reply multiple

Next:
- commit, push, deploy del fix pack
- review finale onesta dei gap ancora aperti e classificazione finale
