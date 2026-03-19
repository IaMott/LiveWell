Timestamp

2026-03-19 12:13

Ruolo

/Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

Riassunto

- Task centrato su sei residui veri emersi dalla campagna sistemica da 230 scenari.
- Nessun redesign: solo patch locali su detection, registry, protocol, compat e synthesis.
- `domainDetection.ts` ora riconosce meglio richieste implicite come dieta, piano alimentare, scheda, burnout, separazione con aspetti legali, debiti/ansia, sfoghi cutanei e problemi digestivi.
- `registry.ts` ora pesa meglio i target impliciti e smette di appoggiarsi troppo a fallback deboli o a matching eccessivamente letterali.
- `protocol.ts` mantiene il consultato su frasi naturali come `continuiamo con lui` e apre checkpoint di handoff implicito piu credibili.
- `compat.ts` tratta gli owner specialistici impliciti come specialist-led anche senza richiesta esplicita del professionista.
- `synthesis.ts` applica il gate prudente anche a `scheda`, `strategia`, `valutazione`, `report`, `menu`, `percorso`.
- Corretto anche il residuo artifact sul `gastroenterologo` senza riaprire l'artifact engine.
- Test aggiunti/aggiornati su detection, trigger guards, protocollo, synthesis e artifact governance.
- Verifiche finali: 34/34 test mirati verdi, `typecheck` verde, `build` verde.

Decisioni prese / next step

- Decisione: mantenere il perimetro backend-only e cross-domain.
- Decisione: correggere il supporto artifact ibrido solo se giustificato da runtime capabilities e tool consentiti.
- Next: commit, push e deploy del diff applicativo.

Prompt chiave (riassunto)

Applicare micro-fix cross-domain sui residui sistemici di triage implicito, consult target, takeover, handoff, gating strutturato e artifact ibridi, con test dimostrativi e senza toccare UI o architettura.
