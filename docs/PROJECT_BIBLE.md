# LiveWell Project Bible

## 1. Scopo del prodotto
LiveWell e una piattaforma di coaching benessere multi-professionista guidata da AI.
L'utente interagisce in chat con un team di specialisti reali (turni distinti), non con un singolo agente che "finge" handoff.

## 2. Invarianti obbligatorie
1. Niente handoff fittizi.
2. Niente frasi tipo "ti passo il collega", "ti contattera il PT", "ora subentra X".
3. Se il contesto richiede piu competenze, devono comparire piu turni specialistici.
4. Ogni bolla assistant deve avere un autore professionista esplicito.
5. La conversazione deve proseguire operativamente: niente stalli narrativi.
6. Le modifiche profilo AI devono essere tracciate con audit/storico.

## 3. Architettura canonica
Flusso messaggio:
1. `src/app/api/chat/route.ts` salva messaggio utente e costruisce contesto.
2. `src/lib/ai/context.ts` calcola `domain`, `knownData`, `missingData`, `requiredData`, memoria specialistica.
3. `src/lib/ai/orchestrator.ts` decide routing (`primarySpecialist`, `supportSpecialists`) e produce turni.
4. Stream SSE:
   - `routing`
   - `agent_turn`
   - `agent_delta`
   - `agent_done`
   - `done`
5. `src/hooks/useChat.ts` crea una bolla per turno specialistico.
6. Risposte assistant salvate con marker `[[specialist:<id>]]`.

## 4. Routing e turnazione: regole operative
1. Richiesta esplicita utente (es. "voglio un medico") forza subito lo specialista target.
2. Handoff contestuale: se obiettivo/dati indicano co-dominio (es. nutrizione + allenamento), coinvolgere automaticamente specialisti multipli.
3. `intervistatore` e usato per raccolta dati, non come "voce ponte" che annuncia altri professionisti.
4. `analista_contesto` non deve comparire come autore nel flusso utente operativo.

## 5. Anti-loop e anti-stallo
1. Pulizia output: bloccare pattern di handoff fittizio.
2. Se un output risulta "stall" (annuncio senza azione), sostituire con domanda operativa concreta.
3. Una domanda per turno in fase raccolta dati.
4. Nessun cambio di tema senza chiusura minima dello stato corrente.

## 6. Memoria e audit
1. Memoria specialistica per conversazione:
   - `settings.aiSpecialistMemory[conversationId][specialistId]`
2. Audit aggiornamenti profilo:
   - `settings.aiAuditLog`
3. Storico allegati contestualizzato:
   - `settings.aiAttachmentHistory`

## 7. File critici (single source of truth)
1. `src/lib/ai/orchestrator.ts` - routing, handoff reale, anti-loop.
2. `src/lib/ai/context.ts` - MVD, continuita dominio, estrazione dati.
3. `src/app/api/chat/route.ts` - stream, persistenza turni, sync profilo.
4. `src/hooks/useChat.ts` - rendering turni specialistici in UI.
5. `src/lib/ai/profile-sync.ts` - scrittura profilo/storico/audit.
6. `src/lib/ai/prompts.ts` - regole runtime di output naturale.

## 8. Regole di modifica (per evitare regressioni)
1. Non introdurre fallback verso `analista_contesto` nel path di chat utente.
2. Non aggiungere testo di handoff nei prompt specialistici.
3. Ogni modifica orchestrator deve preservare eventi `agent_turn/agent_delta/agent_done`.
4. Se si aggiungono specialisti, aggiornare:
   - `src/lib/ai/types.ts`
   - `src/lib/ai/specialists.ts`
   - mapping label in UI (`useChat.ts`, `ChatContainer.tsx`, `LiveSessionOverlay.tsx`)

## 9. Smoke scenario obbligatorio
1. Utente: "voglio dimagrire e mangiare meglio"
2. Utente: "mi alleno 2/3 volte a settimana, pesi e cardio"
3. Utente: "cosa proponete?"
Atteso:
1. turni specialistici reali (almeno Dietista + Personal Trainer),
2. nessun annuncio "ti passo/ti contattera",
3. output operativo, non narrativo.

## 10. Troubleshooting rapido
Se ricompare loop handoff:
1. controllare `routeMessage` in `orchestrator.ts`,
2. controllare filtraggio support specialist (`filterOperationalSupport`),
3. controllare normalizzazione output (`normalizeAssistantOutput` + anti-stall),
4. verificare eventi SSE in `/api/chat` e render in `useChat.ts`.
