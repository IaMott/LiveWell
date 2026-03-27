Timestamp: 2026-03-28 00:13
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto:
- Ripresa dal triage reale prodotto senza rifare review generica.
- Isolati i due cluster a piu` alto ROI rimasti davvero correggibili nel turno:
  1. mapping canonico agente→dominio nei path production-facing
  2. quick replies contestuali incoerenti o fuorvianti
- Confermato che vari path runtime/UI/stream deducevano ancora il dominio dal primo `domainTags[0]`, creando mismatch specialista/dominio visuale.
- Confermato che `contextualQuickReplies` usava solo pattern sull'ultimo blocco di testo e poteva battere `consensus.quickReplies` anche per domande composte.
- Applicato backup locale pre-modifiche e aggiunto resolver condiviso `domainMapping.ts`.
- Estesi `types`, `schema`, `loader` e il profilo `sleep-coach` con `primaryDomain`.
- Riallineati `chat/send`, `chatStream`, `case/compat`, `case/events`, `case/protocol`, `consensus/domainResolver`, `agentExecution`.
- Reso il builder quick replies conservativo: ultima domanda utile, deduplica, `[]` per domande composte.
- Aggiunti test nuovi su domain mapping e quick replies, piu` un guardrail production-facing nel route chat/send.
- Chiusi i problemi di typecheck/build introdotti in corso d'opera.

Decisioni prese / next step:
- Non allargare il refactor oltre mapping dominio e quick replies.
- Pubblicare il fix pack e poi chiudere con verdict onesto: miglioramento reale, ma prodotto ancora non completamente affidabile per via del gap multi-caso/reply multiple e di alcune verifiche browser-side ancora manuali.
