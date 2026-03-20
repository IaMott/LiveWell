Timestamp: 2026-03-20 22:01
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/04-quality-security/qa-expert.md

Riassunto

- ruolo richiesto non esistente come file unico; usato `qa-expert` come match più vicino
- ispezionati `protocol.ts`, `interviewFlow.ts`, `synthesis.ts`, `contextPackBuilder.ts`, `registry.ts`, `domainDetection.ts`, `compat.ts`, `chat/send/route.ts`, `upload/route.ts`
- creato harness temporaneo di validazione e rimosso dopo l’esecuzione
- eseguiti 30 scenari focalizzati su continuità specialistica, consulti attivi, dirty cases, memoria e allegati
- rieseguite suite guardia: interview flow, transcript, synthesis, protocol, runtime triggers, persistence, chat-send persistence
- risultato netto: protocollo regge, ma conversazionalmente il sistema ricade troppo spesso in raccolta dati fondamentale o devia di dominio durante follow-up già specialistici

Decisioni prese / next step

- classificare il cluster come debito conversazionale reale, non come falso positivo di testing
- se richiesto, intervenire con micro-fix stretti su `interviewFlow.ts`, `domainDetection.ts`, `registry.ts`, `protocol.ts`, `synthesis.ts`

Prompt chiave (riassunto)

Verificare se il sistema mantiene davvero il focus del problema attivo e si comporta come un professionista disciplinato nei follow-up, non solo se il protocollo tecnico esiste.
