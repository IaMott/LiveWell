Stato progetto

Obiettivo

Chiudere completamente il residuo B4 con un micro-fix in `src/lib/ai/artifacts/contracts.ts`, allineando l'istruzione di professional output al gating prudente gia presente in `synthesis.ts`, senza toccare UI o altri moduli.

Fatto

Micro-fix B4 applicato in `src/lib/ai/artifacts/contracts.ts`:
- rimossa la permissivita residua che invitava ad assumere valori ragionevoli quando mancano dati;
- sostituita con una regola coerente col gating prudente: se mancano dati essenziali, chiedere i dati mancanti oppure fornire solo una struttura preliminare chiaramente incompleta.
Il test esistente di synthesis e stato rafforzato in modo minimo per verificare anche la coerenza di `buildProfessionalOutputInstructions()`.
Verifiche eseguite:
- `npm run typecheck` verde
- `npm run test -- tests/api/orchestrator-synthesis.test.ts` verde (5/5)

In corso

Nessuna modifica in corso; micro-fix chiuso localmente e pronto alla pubblicazione remota.

Prossimo

Commit, push e deploy del micro-fix B4.

Rischi

Nessun rischio nuovo nel perimetro del micro-fix.
Rimangono solo i rischi gia noti fuori da questo step: enforcement dei prerequisiti artifact ancora minimo-equivalente, parser capability dipendente da heading markdown coerenti, `activeSpecialist` ancora compatibilita di output.

Ultimo aggiornamento

2026-03-19 01:17
