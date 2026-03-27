2026-03-27 23:08
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- La QA production aveva confermato che il fix UI domini non si attivava per un problema a monte: `ui.state.domain`, `leadDomain`, `activeDomains` e `assistant.domain` uscivano ancora `general`.
- Il fix applicato e` stretto e non riapre la UI.
- In `src/lib/ai/orchestrator/orchestrator.ts` viene ora costruito un `stateSnapshot` canonico arricchito:
  - usa `detectedDomain/allDomains`
  - usa speaker corrente e specialista effettivo
  - usa gli agenti selezionati dal routing
  - preserva il pannello precedente non-lead quando il contesto resta multi-dominio
- I casi coperti dai nuovi guardrail:
  - prompt monodominio training -> `leadDomain=training`, `activeDomains=['training']`
  - follow-up health+training -> `leadDomain=health`, `activeDomains` contiene `health` e `training`, pannello training preservato
- La route `chat/send` era gia` corretta nel consumare lo snapshot; per questo ho aggiunto solo asserzioni sulla persistenza `assistant.domain`.
- Validazioni locali verdi:
  - `npm run test -- tests/api/chat-orchestration.test.ts tests/api/chat-send-persistence.test.ts tests/api/chat-shell-domain-visuals.test.ts tests/api/chat-input-domain-highlights.test.ts tests/api/message-bubble-domain-color.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

decisioni prese / next step:
- prossimo step obbligatorio: publish remoto e smoke production sugli stessi prompt già falliti
