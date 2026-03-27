Timestamp: 2026-03-27 21:40
Ruolo: /Users/mattiamottisi/Desktop/LiveWell/agenti/categories/04-quality-security/qa-expert.md

Riassunto

- Verifica production eseguita con utente smoke reale.
- Sessione NextAuth valida ottenuta su `livewell.mottisi.com`.
- Transcript route:
  - user `va bene` salvato correttamente
  - assistant pulito salvato correttamente dopo l'user
  - export/load senza `Payload:`
  - assistant multilinea misto payload+testo visibile scartato interamente
- Chat send route:
  - `ui.state.specialistName=Fisioterapista`
  - messaggio assistant persistito con `specialistName=Fisioterapista`
  - export senza payload interni

Decisioni prese / next step

- Verdict: ordering `PASS`, filtering `PARTIAL`, speaker consistency `PASS` lato data path production.
- Next: aprire fix stretto sul filtering del transcript assistant mixed-content.
