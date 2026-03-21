Timestamp: 2026-03-21 09:16
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto:
- richiesta: correggere solo il cluster conversazionale dei follow-up specialistici già avviati
- safety net creata prima delle modifiche con branch snapshot `backup/2026-03-21_0911_conversation-focus-fix`
- trovati punti caldi in `interviewFlow.ts` (priorità domande), `domainDetection.ts` (negazioni e drift), `protocol.ts` (return baton), `registry.ts` (ranking consult noisy), `synthesis.ts` (resume poco vincolante)
- applicati micro-fix stretti senza toccare UI o architettura generale
- aggiunti test su follow-up digestivi, pain follow-up, dirty case ricco, negazioni sonno/alimentazione, burnout vs carriera, consulti legal/financial attivi, synthesis con known case context
- eseguiti test mirati e guardie di non regressione con esito verde
- `typecheck` verde
- `build` verde

Decisioni prese / next step:
- il problema era di priorità conversazionale, non di protocollo di base
- il prossimo passo corretto è una validazione mirata post-fix, non un altro fix cieco

Prompt chiave (riassunto):
- evitare intake baseline fuori timing
- restare sul problema attivo con memoria e consulti già avviati
- mantenere coerenza specialistica su burnout/sonno/legal/financial
