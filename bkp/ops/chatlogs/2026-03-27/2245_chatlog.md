timestamp: 2026-03-27 22:45
ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/01-core-development/backend-developer.md

riassunto:
- publish completato del fix UI domini/chat
- commit applicativo: `ded544c`
- push su `origin/main` riuscito
- deploy production Vercel completato
- URL deploy: `https://livewell-klpef43xp-iamotts-projects.vercel.app`
- alias verificato: `https://livewell.mottisi.com`
- verifica HTTP finale: redirect `307` verso `/login`
- nessun errore emerso in typecheck, lint, build o test mirati del fix
- il banner alto `modalità specialista attiva` non fa piu` parte del flusso UI previsto
- i pulsanti dominio sono di nuovo governati dal dominio canonico corrente e dal set multi-dominio attivo
- le bolle assistant ricevono il fallback colore del dominio attivo

decisioni / next:
- nessun fix obbligatorio aperto nel perimetro richiesto
- prossimo passo solo su richiesta utente: verifica manuale browser-side oppure nuova track separata
