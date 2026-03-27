timestamp: 2026-03-27 16:16
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- review precedente aveva lasciato aperta una sola track obbligatoria: il routing multi-dominio ancora troppo keyword-heavy
- il refactor gia` avviato e` stato completato con un nuovo resolver contestuale
- l'orchestrator ora tenta un routing LLM-driven strutturato e usa snapshot/history continuity prima delle euristiche
- il protocol non apre piu` consult takeover prematuri nei follow-up contestuali se il panel/speaker corrente e` gia` coerente col dominio
- il ranking usa i preferredAgentIds ordinati del panel come segnale primario, con hints statici ridotti a booster
- aggiunti test end-to-end e production-path per provare source `llm_context`, continuity snapshot-first e ranking context-first
- chiuso anche il warning lint residuo su `UserAvatar.tsx`
- validazioni verdi su typecheck, lint, build e 216 test mirati

decisioni prese:
- `KEYWORDS`, `SPECIALIST_KEYWORDS` e `AGENT_COMPETENCE_HINTS` restano solo come supporto/fallback
- il path production corretto del routing e` ora: domainHint esplicito -> llm_context -> snapshot/history context -> fallback euristico

next step:
- commit + push + deploy + verifica alias production
- review finale totale per decidere il verdetto conclusivo
