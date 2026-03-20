Timestamp: 2026-03-20 11:59
Ruolo: backend-developer

Prompt (riassunto)
Applicare solo due micro-fix stretti ai residui confermati della review del commit `c9b21d2`: consulto implicito legal su `problemi legali con la separazione` e same-domain takeover su `parliamo ancora di questo con lui`.

Risultato (riassunto)
- `registry.ts` corretto sui segnali giuridici espliciti in forma flessa (`legali`)
- `protocol.ts` corretto per mantenere takeover su `parliamo ancora di questo con lui`
- test aggiornati su legal positivo e takeover residuo
- verifiche verdi: 37/37 test mirati, 24/24 suite di guardia, `typecheck`, `build`

Evidenze
- `src/lib/ai/capabilities/registry.ts`
- `src/lib/ai/case/protocol.ts`
- `tests/api/runtime-trigger-guards.test.ts`
- `tests/api/case-protocol.test.ts`

Decisioni
- i segnali family-law restano stretti e non riaprono falsi positivi emotivi
- l'handoff same-domain resta disponibile solo sui phrasing più forti

Next
Nuova validazione mirata post-fix sui due casi corretti.
