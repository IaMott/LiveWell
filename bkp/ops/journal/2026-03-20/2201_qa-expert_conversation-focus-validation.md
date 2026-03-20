Timestamp: 2026-03-20 22:01
Ruolo: qa-expert

Prompt (riassunto)

Validazione mirata del sistema conversazionale sui bug di continuità del focus in conversazioni specialistiche già avviate, senza patch, con valutazione severa della credibilità conversazionale oltre al solo protocollo.

Risultato (riassunto)

- eseguiti 30 scenari mirati con harness temporaneo sul team reale
- rieseguite 8 suite di guardia (`75/75` test verdi)
- protocollo tecnico confermato
- comportamento conversazionale solo parzialmente credibile
- bug principali:
  - ritorno a intake baseline / goal generici durante follow-up specialistici già vivi
  - cambio dominio/consulto non credibile su burnout, sonno, finanza, separazione pratica
  - consulti attivi che si svuotano in domande generiche o tornano all’owner sbagliato

Evidenze

- `/tmp/livewell_conversation_focus_audit.json`
- `src/lib/ai/orchestrator/interviewFlow.ts`
- `src/lib/ai/case/protocol.ts`
- `src/lib/ai/capabilities/registry.ts`
- `src/lib/ai/domain/domainDetection.ts`
- `src/lib/ai/orchestrator/synthesis.ts`

Decisioni

- trattare il cluster come debito conversazionale reale
- non proporre refactor generale
- se si interviene, partire da interview flow + routing implicito + ranking consulti

Next

Consegna report strutturato e, se richiesto, preparazione di un micro-fix strettissimo sui moduli del cluster.
