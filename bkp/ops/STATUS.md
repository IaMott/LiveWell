Stato progetto

Obiettivo

Allineare intake, profile extraction e live mode al piano operativo A+B+C: eta salvata come data di nascita approssimata, intake per dominio senza domande hardcoded verbatim, contesto live coerente con `conversationId` e specialista attivo.

Fatto

- checkpoint locale creato in `bkp/backups/2026-03-25/2330_pre-a-b-c-live-fix`
- `agentPrompt.ts` aggiornato con regole condivise su `birth_date`, profile extraction su tutti i `recentMessages` e separazione esplicita nutrition/training nei casi misti
- `inputInference.ts` allineato: quando l'utente dichiara l'eta viene prodotto `birthDate` approssimato invece di `age`
- `interviewFlow.ts` lasciato senza iniezione verbatim da `FIELD_QUESTIONS`; le domande contestuali restano responsabilita dell'LLM via checklist intake
- `intakeQuestions.ts` aggiornato sui campi richiesti per dominio, con bridge `birthDate`/`birth_date` e rimozione dei residui di domande hardcoded inutilizzati
- `live-token/route.ts` aggiornato con contesto esplicito dello specialista attivo per la conversazione
- `LiveModal.tsx` e `ChatInput.tsx` aggiornati per passare `conversationId` a `/api/live-token` gia all'avvio della sessione live
- test mirati verdi: `orchestrator-input-inference`, `multi-agent-execution`, `orchestrator-agent-prompt`, `live-token-fallback-observability`, `live-token-security`
- `typecheck` verde
- `build` verde
- commit pubblicato: `1f527be` (`fix: align live intake and context handling`)
- push su `origin/main` completato
- deploy production Vercel completato su `https://livewell.mottisi.com`
- smoke HTTP positivo su alias production

In corso

Pubblicazione remota del fix che impedisce di derivare `birthDate` da `age`.

Prossimo

- commit del fix applicativo
- push su `origin/main`
- deploy production
- smoke rapido post-deploy

Rischi

Rischi reali aperti:
- il runtime interno conserva path legacy che leggono `age` e `birthDate` separatamente; questo step elimina l'invenzione della data completa ma non introduce ancora un modello `birthYear` dedicato
- il deploy Vercel continua a segnalare warning infrastrutturali preesistenti (`middleware` deprecato, multiple lockfiles, vulnerabilita npm) non bloccanti per questo fix
- dal terminale non e possibile verificare end-to-end in produzione la sessione live autenticata con microfono/browser; i punti 1 e 2 sono quindi verificabili solo a livello di wiring codice + test, non con prova UX reale
- il fix corrente e solo locale finche commit/push/deploy non vengono completati

Ultimo aggiornamento

2026-03-26 00:19
