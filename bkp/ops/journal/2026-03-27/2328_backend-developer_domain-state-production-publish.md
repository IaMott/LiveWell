Timestamp: 2026-03-27 23:28
Ruolo: backend-developer

Prompt (riassunto)

- correggere il path production che serializzava `general` verso la UI domini/chat
- far arrivare alla UI il dominio canonico reale
- valorizzare `leadDomain`, `activeDomains` e `assistant.domain`
- aggiungere test production-facing mirati

Risultato (riassunto)

- commit applicativo `507bbb9` pushato su `origin/main`
- deploy production completato su `https://livewell-kpaijav1b-iamotts-projects.vercel.app` con alias `https://livewell.mottisi.com`
- smoke production PASS sulla conversazione `cmn9gm9iy000111ahsyh3lu1r`
- prompt training serializza `ui.state.domain=training`, `leadDomain=training`, `activeDomains=['training']`, `assistant.domain=training`
- follow-up health+training serializza `ui.state.domain=health`, `leadDomain=health`, `activeDomains` contenente `health` e `training`, `assistant.domain=health`

Evidenze

- `/tmp/livewell_domain_fix_sse1.txt`
- `/tmp/livewell_domain_fix_conv1.json`
- `/tmp/livewell_domain_fix_sse2.txt`
- `/tmp/livewell_domain_fix_conv2.json`
- `src/lib/ai/orchestrator/orchestrator.ts`
- `tests/api/chat-orchestration.test.ts`
- `tests/api/chat-send-persistence.test.ts`

Decisioni

- chiudere il bug sul path backend production-facing senza riaprire il fix UI puro
- usare come prova finale i payload production reali consumati dalla UI, non solo i test locali

Next

- nessun fix obbligatorio aperto su questo bug
- eventuale QA browser-side solo come conferma visuale finale
