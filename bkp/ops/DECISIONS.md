Decision log (ADR light)

2026-03-18 21:08 | ADR-2026-03-18-2108 | Decisione: usare `llm-architect` come ruolo implicito per questo task. Motivo: richiesta centrata su architettura LLM multi-agent, governance runtime, state model, artifact generation e refactoring strutturale. Stato: attiva.

2026-03-18 21:08 | ADR-2026-03-18-2108-B | Decisione: trattare `capabilities.md` come documentazione non eseguita dal runtime fino a prova contraria. Motivo: `src/lib/ai/team/loader.ts` carica solo `profile.json` + `prompt.md`; nessun path runtime risolve o valida `capabilities.md`. Stato: attiva.

2026-03-18 22:35 | ADR-2026-03-18-2235 | Decisione: il primo refactor incrementale deve introdurre subito un `CaseState` canonico con owner del caso, active speaker, consulto attivo e return target. Motivo: e il minimo slice che sposta la collaborazione da teatralizzazione SSE/prompt a protocollo persistito e tracciabile. Stato: attiva.

2026-03-18 22:35 | ADR-2026-03-18-2235-B | Decisione: `activeSpecialist` va mantenuto solo come campo di compatibilita derivato in uscita, non piu come fonte di verita. Motivo: evita doppia ownership e consente migrazione graduale di `route.ts`, `chatStream.ts` e `ChatContext.tsx` senza toccare la UI. Stato: attiva.

2026-03-18 23:15 | ADR-2026-03-18-2315 | Decisione: persistere `CaseState` in una nuova tabella `case_states` dedicata, non in `AgentWorkspace`. Motivo: `AgentWorkspace` resta memoria locale dell'agente; `CaseState` deve essere stato canonico del protocollo. Stato: implementata.

2026-03-18 23:15 | ADR-2026-03-18-2315-B | Decisione: trattare `activeSpecialist` come compatibilita derivata solo in due casi: takeover reale o richiesta esplicita iniziale dell'utente verso uno specialista. Motivo: evitare che un owner auto-inizializzato blocchi impropriamente il routing o la raccolta dati. Stato: implementata.

2026-03-18 23:30 | ADR-2026-03-18-2330 | Decisione: introdurre `handoff_pending_user` come checkpoint umano backend-native prima dell'handoff permanente. Motivo: serviva un passaggio verificabile dal runtime che separasse takeover temporaneo da cambio owner definitivo senza richiedere modifiche UI. Stato: implementata.

2026-03-18 23:30 | ADR-2026-03-18-2330-B | Decisione: caricare `TEAM/**/capabilities.md` nel runtime come capability contracts minimali, usando parsing markdown e fallback conservativi. Motivo: spostare competenze, limiti, trigger e artefatti fuori da documentazione morta e dai prompt sparsi. Stato: implementata.

2026-03-18 23:30 | ADR-2026-03-18-2330-C | Decisione: governare `artifactsToSave` tramite `src/lib/ai/artifacts/governance.ts` e contratti runtime dello specialista, sostituendo il merge diretto in `consensusEngine.ts`. Motivo: gli artefatti dovevano diventare responsabilita architetturale e non side effect libero dei recommendation text. Stato: implementata.

2026-03-18 23:48 | ADR-2026-03-18-2348 | Decisione: rendere illegale `activeSpecialistId` come input backend del runtime e lasciarlo solo come compatibilita derivata in output. Motivo: chiudere la seconda verita residua sul caso senza toccare il client. Stato: implementata.

2026-03-18 23:48 | ADR-2026-03-18-2348-B | Decisione: confinare `resolveRoutingContext` in `src/lib/ai/orchestrator/routingLegacy.ts` e lasciare `routing.ts` focalizzato sul path nuovo candidate-only. Motivo: isolare il legacy ancora necessario senza farlo sembrare parte del percorso vivo del nuovo modello. Stato: implementata.

2026-03-18 23:48 | ADR-2026-03-18-2348-C | Decisione: estrarre i builder di contesto da `synthesis.ts` in `synthesisContext.ts` e irrobustire il parser di `capabilities.md` con alias heading e normalizzazione markdown. Motivo: ridurre il monolite residuo e rendere i capability contracts piu affidabili a runtime. Stato: implementata.

2026-03-19 00:14 | ADR-2026-03-19-0014 | Decisione: considerare `typecheck`, `build` e suite test mirata del refactor multi-agent come publish gate sufficiente per questo rilascio, nonostante `npm run lint` resti rumoroso su output generati esterni al diff sotto `.claude/worktrees/.../.next/`. Motivo: il blocco lint non deriva dal refactor pubblicato e non deve impedire commit/push/deploy del backend gia validato. Stato: attiva.
