Timestamp: 2026-03-11 16:24
Ruolo: backend-developer

Prompt (riassunto)
- Persistenza modalità specialistica tra navigazioni.
- Reset completo DB per ripartire da zero.
- Fix output inconcludenti del team.
- Aggiunta stream ragionamento agenti durante thinking con switch visuale.

Risultato (riassunto)
- Specialist lock persistente lato client tramite localStorage (id+nome).
- Fallback orchestrator-safe reso operativo e contestuale per dominio.
- Nuovo evento SSE `agent.thinking` con titolo ragionamento.
- Thinking UI aggiornata con nome agente + titolo e animazione di switch.
- Reset DB eseguito con force-reset su datasource configurato.

Evidenze
- src/hooks/useChat.ts
- src/app/api/chat/send/route.ts
- src/components/chat/MessageBubble.tsx
- tests/api/chat-send-persistence.test.ts
- comando DB reset: `npx prisma db push --force-reset --skip-generate`

Decisioni
- Manteniamo one-question-per-turn e queue invariati.
- Eliminato fallback testuale “problema tecnico” in favore di risposta utile.

Next
- Commit/push/deploy e verifica production eventi `agent.thinking` dopo deploy.
