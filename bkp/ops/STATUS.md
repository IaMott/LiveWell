Stato progetto

Obiettivo

Correggere l'export dei ragionamenti agenti in modo che mostri il reasoning completo delle proposal e non solo step sintetici di stato.

Fatto

- checkpoint Git creato prima del fix su branch `backup/2026-03-23_2221_full-thinking-export-before-fix`
- `chat/send/route.ts` aggiornato per persistere il reasoning ricco delle `round1/round2 proposals` come fonte primaria del thinking esportabile
- il fallback ai soli eventi sintetici di stream resta attivo solo quando non esistono proposal utilizzabili
- export conversazione aggiornato per stampare tutto il reasoning multilinea, non solo una riga sintetica
- `MessageBubble.tsx` aggiornato con `whiteSpace: pre-wrap` per mantenere leggibili i ritorni a capo del reasoning completo
- test di regressione aggiunti/aggiornati in `chat-send-persistence` e `conversation-thinking-export`
- `typecheck` verde
- `446/446` test verdi
- `build` verde
- commit pubblicato: `e7d8c9b` (`fix: export full agent reasoning traces`)
- push su `origin/main` completato
- deploy production Vercel completato su `https://livewell.mottisi.com`

In corso

Nessuna attivita obbligatoria aperta su questo fix.

Prossimo

Eventuale nuovo export reale da UI per verificare che nel `.txt` compaia il reasoning completo delle proposal degli specialisti.

Rischi

Rischi reali aperti:
- se un turno non produce proposal valide e resta solo lo stream sintetico, l'export ricade ancora sul fallback meno ricco per quel singolo messaggio

Rischi non riaperti:
- consulti/takeover/handoff
- queue / `pendingQuestions`
- gating strutturato
- artifact governance
- upload/backend file support di base

Ultimo aggiornamento

2026-03-23 22:35
