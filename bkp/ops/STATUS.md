Stato progetto

Obiettivo

Correggere in modo mirato i bug B1-B5 emersi dalla validazione del runtime multi-agente: trigger capability realmente usati dal protocollo, artifact governance piu rigorosa, enforcement prerequisiti minimi, gating degli output con dati mancanti e stream piu protocol-first, senza modificare la UI.

Fatto

Correzioni B1-B5 applicate nel backend:
- `consultTriggers` e `handoffTriggers` entrano davvero nel protocollo runtime via `src/lib/ai/case/protocol.ts` e `src/lib/ai/capabilities/registry.ts`.
- L'inferenza artifact dai capability contracts e stata ristretta ai domini dichiarati e ai tool consentiti, evitando over-permission cross-domain.
- La governance artifact blocca salvataggi quando mancano prerequisiti minimi equivalenti, usando `medicalRecord.missingKeys` del dominio rilevante.
- `synthesis.ts` non tratta piu le plan request come override automatico del gating: con dati critici mancanti il sistema chiede dati o limita l'output a struttura parziale.
- Lo stream backend e piu protocol-first: se esistono `protocolEvents`, i thinking events proposal-based non vengono piu usati come semantica principale.
- Verifiche locali completate: `npm run typecheck`, `npm run build`, 27/27 test mirati verdi su protocollo, artifact governance, capability loading, synthesis e stream/persistence.

In corso

Nessuna modifica ulteriore in corso; step chiuso localmente e pronto alla pubblicazione remota.

Prossimo

Commit, push e deploy del fix backend B1-B5 con verifica post-deploy.

Rischi

`activeSpecialist` esiste ancora in output SSE/client come compatibilita derivata; non e piu input decisionale ma resta finche il client usa quel campo.
`resolveRoutingContext` esiste ancora come percorso legacy confinato in `routingLegacy.ts`; non e piu il path vivo del nuovo runtime, ma non e ancora rimosso del tutto.
Il parser dei capability contracts e piu rigoroso sugli artifact, ma resta dipendente da heading markdown coerenti.
L'enforcement dei prerequisiti artifact usa `medicalRecord.missingKeys` come gate minimo equivalente; non e ancora una validazione semantica completa campo-per-campo.
`npm run lint` resta rumoroso su file generati/non pertinenti sotto `.claude/worktrees/.../.next/`; non ha bloccato il publish perche `typecheck`, `build` e test mirati del diff sono verdi.

Ultimo aggiornamento

2026-03-19 01:01
