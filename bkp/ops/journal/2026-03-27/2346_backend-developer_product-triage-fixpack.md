timestamp: 2026-03-27 23:46
ruolo: backend-developer
prompt_riassunto: chiudere i bug di prodotto piu` credibili e correggibili nel perimetro reale senza fermarsi alla sola analisi, con validazione, publish e verdetto finale onesto

risultato_riassunto:
- feedback persistito e reidratato al refresh
- forgot/reset password resi di nuovo pubblicamente raggiungibili dal login
- `thinkingSteps` live ora emessi dal sync e persistiti nel transcript condiviso
- `conversationId` creato in live sincronizzato nel context globale e in `localStorage`
- lo specialista non viene piu` mostrato in anticipo su reasoning incompleto
- bootstrap live arricchito con documenti, artefatti e note correlate dal DB

evidenze:
- src/components/chat/FeedbackWidget.tsx
- src/lib/auth.config.ts
- src/app/api/chat/live-sync/route.ts
- src/app/api/chat/transcript/route.ts
- src/components/chat/ChatInput.tsx
- src/components/chat/ChatShell.tsx
- src/contexts/ChatContext.tsx
- src/app/api/live-token/route.ts
- tests/api/feedback-widget-refresh.test.ts
- tests/api/auth-public-pages.test.ts
- tests/api/chat-transcript-route.test.ts
- tests/chat-input-live-ordering.test.tsx
- tests/api/live-sync-stateSnapshot.test.ts
- tests/api/chat-context-live-runtime.test.tsx
- tests/api/live-token-fallback-observability.test.ts

decisioni:
- chiudere solo i bug confermati ad alto ROI nel perimetro attuale
- non dichiarare chiuso il modello multi-caso/reply multiple, che richiede una track separata

next:
- commit, push, deploy della baseline corretta
- chiusura finale con verdict `ISSUES FOUND` se il gap multi-caso/reply multiplo resta aperto come feature reale mancante
