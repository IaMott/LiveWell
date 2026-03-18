Stato progetto

Obiettivo

Pubblicare il cleanup tecnico backend gia applicato e verificato, con commit, push su `origin/main` e deploy production su Vercel, senza toccare la UI.

Fatto

Commit applicativo del cleanup creato e pubblicato: `dcc68ae` (`chore: tighten backend compatibility cleanup`).
Push completato su `origin/main`.
Deploy production completato su Vercel: `https://livewell.mottisi.com` (deployment `https://livewell-pf3mfgr0d-iamotts-projects.vercel.app`).
Verifiche eseguite prima della pubblicazione: `npm run typecheck` + suite test mirata sul cleanup (22 test verdi).

In corso

Nessuna modifica ulteriore in corso.

Prossimo

Nessun passo obbligatorio aperto in questo perimetro. Eventuali passi futuri facoltativi: rimuovere del tutto `routingLegacy.ts` quando non servira piu ai test e pianificare l'eliminazione finale dell'output compatibile `activeSpecialist` quando il client potra consumare direttamente il payload semantico.

Rischi

`activeSpecialist` esiste ancora in output SSE/client come compatibilita derivata; non e piu input decisionale ma resta finche il client usa quel campo.
`resolveRoutingContext` esiste ancora come percorso legacy confinato in `routingLegacy.ts`; non e piu il path vivo del nuovo runtime, ma non e ancora rimosso del tutto.
Il parser dei capability contracts e ora robusto per il formato attuale di `capabilities.md`, ma resta dipendente da heading testuali coerenti.
`npm run lint` resta rumoroso su file generati/non pertinenti sotto `.claude/worktrees/.../.next/`; non ha bloccato il publish perche `typecheck`, `build` e test mirati del diff sono verdi.
`routingLegacy.ts` e `activeSpecialist` in output restano compatibilita deliberate, non piu debito ambiguo nel path vivo.

Ultimo aggiornamento

2026-03-19 00:42
