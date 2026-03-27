timestamp: 2026-03-27 22:40
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- richiesta utente: ripristinare i pulsanti dominio vivi nella barra in basso e togliere il banner alto della modalità specialistica
- analisi non ripetuta: il problema reale era una regressione di priorità visuale in `ChatShell`
- prima del fix, il dominio visuale usava ancora `latestAssistantWithDomain` come priorità
- questo impediva lo switch corretto quando il dominio corrente cambiava nel canonico
- `ChatInput` era ancora single-domain puro e non rendeva bene il multi-dominio
- `MessageBubble` non riceveva esplicitamente il dominio visuale corrente come fallback
- fix applicato:
- `ChatInput` ora supporta `activeDomains` multipli con highlight simultaneo
- `ChatShell` fa vincere `activeDomain/stateSnapshot` e rimuove il banner alto
- `MessageList` propaga `activeDomain`
- `MessageBubble` usa il dominio attivo di fallback per la colorazione assistant
- aggiunti tre test nuovi nel perimetro `tests/api`
- validazioni locali verdi: test mirati, typecheck, lint, build

decisioni prese / next step:
- non riaprire transcript/output/speaker o il multi-agente generale
- tenere il fix confinato alla UI domini/chat
- prossimo step operativo: publish remoto e verifica alias production
