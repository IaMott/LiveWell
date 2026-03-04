Questo file imposta un flusso di lavoro stabile e ripetibile per gli agent:
• attivi un “ruolo” alla volta (file .md)
• l’agent lavora per step e si ferma sempre
• il contesto non vive solo nella chat: viene salvato su file (memoria) con storico
• i backup del codice funzionano anche senza Git (backup locale in /bkp)
• quando manca contesto, niente blocchi: default o Wizard
• salvataggi (memoria/chatlog/backup) avvengono anche in autonomia, non solo via comando
• vietati i “teatrini” di contesto (meta-query fittizie): il lavoro deve proseguire
• “PROCESSO ULTIMATO” va scritto **solo** quando l’intera richiesta dell’utente è stata completata end-to-end (tutte le modifiche/verifiche richieste sono state eseguite e non ci sono azioni pendenti).
• Non scrivere “PROCESSO ULTIMATO” a ogni singolo output/step intermedio.
• Quando il processo è davvero completato, stampa **su una riga dedicata** esattamente: “PROCESSO ULTIMATO” (poi applica la normale regola di STOP).

## Default behavior (anti-blocco)

- Se l’utente NON specifica un ruolo (ROLE:/RUOLO:), l’agente deve **scegliere automaticamente** il ruolo migliore e procedere.
- Se l’utente invoca un comando definito in questo file (es. RIPRENDI/MEMORIA/SNAPSHOT/CHECKPOINT/CHATLOG), l’agente deve **eseguirlo subito** senza chiedere chiarimenti.

### Come scegliere il ruolo automaticamente

1. Se il messaggio contiene parole chiave evidenti, scegli il ruolo corrispondente (match “miglior sforzo”):
   - bug/errore/stacktrace/build failing/test failing → `debugger` o `code-reviewer`
   - UI/icone/layout/CSS → `frontend-developer`
   - performance/lentezza/profiling → `performance-engineer`
   - sicurezza/auth/permessi → `security-reviewer`
   - dati/DB/migrazioni/API → `database-admin` o `backend-developer`
2. Se non c’è match chiaro, usa `code-reviewer` come default “sicuro” (analisi + proposta) e procedi.
3. Se servono davvero scelte dell’utente, usa il Wizard (max 6 domande) **ma intanto** proponi una opzione ⭐ consigliata e vai avanti con quella se non risponde.

### Regola pratica

- **Mai** mostrare un “menu” di opzioni all’utente come prima risposta.
- Se manca contesto, applica i default sopra e dichiara 3–5 righe di assunzioni, poi continua.

## Language policy

- Rispondi in italiano.
- Non tradurre mai: codice, comandi, path, nomi file, identificatori, diff.

⸻

Libreria ruoli

I ruoli sono file Markdown in:
• ./agenti/categories/

Esempio:
• ./agenti/categories/\*\*/code-reviewer.md

⸻

Attivazione ruolo

Quando l’utente scrive:

ROLE: <nome-ruolo>
oppure
RUOLO: <nome-ruolo>

L’agente deve: 1. Cercare e aprire ./agenti/categories/\*\*/<nome-ruolo>.md 2. Ignorare il front-matter YAML se presente (tra --- e ---) 3. Applicare SOLO le istruzioni di quel ruolo per il task corrente 4. Eseguire SOLO lo step richiesto (no attività extra) e poi fermarsi

⸻

Regola di stop (obbligatoria)

Dopo aver completato lo step, termina SEMPRE con:

STOP (attendo conferma per proseguire)

L’agente NON deve procedere finché non rileva un chiaro intento di avanzamento.

Avanzamento (non rigido)

Considera “vai avanti” qualsiasi messaggio che contenga chiaramente:
• andare avanti / continuare / procedere
• ok / va bene / perfetto / ci sta
• next / avanti

Esempi che DEVONO avanzare:
• “next”, “avanti”, “procedi”, “prosegui”, “continua”, “ok”, “va bene”
• “ok, vai avanti”
• “continua pure”

Esempi che NON devono avanzare:
• domande o richieste nuove (es. “perché…”, “spiega…”, “cambia il prompt…”)
• consenso + richiesta diversa (es. “ok ma prima dimmi…”)

Regola anti-sviste

Se nel messaggio c’è sia consenso sia una richiesta diversa:
• NON avanzare
• chiedi: “Vuoi che proceda allo step successivo?”

⸻

Formato output (sempre uguale)

All’inizio di ogni risposta:
Path ruolo aperto: <path completo>

Sezioni obbligatorie:
• Risultato
• Evidenze (file/cartelle citate)
• Problemi prioritari
• Raccomandazioni
• Handoff

Handoff operativo (obbligatorio)

In Handoff includi SEMPRE:
• Prossimo ruolo consigliato: <nome-ruolo>
• Prompt pronto da incollare (3–10 righe)

⸻

Se il ruolo non esiste

Se non trovi ./agenti/categories/\*\*/<nome-ruolo>.md:
• dillo chiaramente
• proponi 3 ruoli simili (per nome file)

⸻

CHIARIMENTO: “META-QUERY VIETATE” (per evitare blocchi inutili)

Cosa NON devi fare (vietato)

È vietato “simulare” chiamate interne o workflow fittizi che bloccano il lavoro, ad esempio:
• “Avvio context/system query…”
• get\_\*\_context
• oggetti JSON inventati con request_type, payload, ecc.
• richieste di contesto “generico” che impediscono di procedere (“mancano standard/security/performance…” → STOP)

Queste sono chiamate “meta-query”: non aggiungono valore operativo e interrompono il flusso.

Cosa PUOI e DEVI fare invece (permesso + richiesto)

Se un ruolo “vorrebbe” contesto: 1. Procedi comunque con default ragionevoli basati su ciò che vedi (repo/config/testi allegati) e dichiara le assunzioni in 3–5 righe. 2. Se serve davvero una scelta dell’utente, usa il Wizard (max 6 domande) e intanto vai avanti con le opzioni ⭐ consigliate se non risponde. 3. Se un ruolo dice “chiedi al context-manager…”, interpretalo così:
• “Raccogli il minimo contesto utile” (da file o da 1–2 domande mirate all’utente),
• non avviare meta-query o payload fittizi.

Nota: è lecito scrivere una frase tipo:

“Il ruolo prevede una fase di raccolta contesto; ho proseguito con assunzioni esplicite perché AGENTS.md vieta meta-query fittizie.”

⸻

AUTONOMIA OBBLIGATORIA (salva tutto senza comando)

Principio

Anche se l’utente NON scrive comandi, l’agente deve:
• salvare memoria e storico a fine step
• salvare un chatlog a fine step
• fare backup del codice:
• SEMPRE prima di modifiche
• SEMPRE dopo modifiche significative
• con fallback locale se Git non esiste

Regola “no changes without safety”

Se stai per MODIFICARE qualsiasi file (codice/config/test/docs):
• esegui automaticamente un CHECKPOINT prima di iniziare (memoria + snapshot/backup)
• applica modifiche in piccoli blocchi
• esegui automaticamente MEMORIA + CHATLOG a fine step
• poi STOP

Se non puoi scrivere su disco / non hai permessi / ambiente limitato

Se l’ambiente non consente creazione file/cartelle o copia backup:
• dichiaralo chiaramente
• non inventare che il backup è stato creato
• stampa i comandi/azioni manuali minime che l’utente deve eseguire per ottenere lo stesso risultato
• prosegui con analisi e piano, ma non applicare modifiche finché non esiste una safety net

⸻

PUBBLICAZIONE REMOTA AUTOMATICA (GitHub/Vercel/altro)

Obiettivo

Se il progetto NON è solo locale, l’agente deve chiudere il ciclo fino alla pubblicazione remota senza aspettare un comando extra dell’utente.

Rilevamento contesto (obbligatorio, in quest’ordine) 1. Verifica se esiste `.git/` e almeno un remote (`git remote -v`) 2. Se remote presente (GitHub/GitLab/Bitbucket): il progetto è remoto-versionato 3. Verifica piattaforma deploy dal repo:
• Vercel: `vercel.json` o `.vercel/`
• Netlify: `netlify.toml`
• Cloudflare Pages: config/wrangler compatibile
• Altra piattaforma: usa i comandi già presenti in script/README/workflow

Regola decisionale
• Se NON esiste remote Git: lavora solo in locale (backup + memoria).
• Se esiste remote Git: dopo modifiche validate l’agente deve fare automaticamente: 1) `git add` mirato ai file toccati 2) `git commit` con messaggio chiaro 3) `git push` al branch corrente 4) deploy con il comando coerente alla piattaforma rilevata 5) verifica rapida post-deploy (stato comando/URL/versione servita)

Validazioni minime prima della pubblicazione
• build/typecheck/test richiesti dal task devono essere PASS
• se falliscono, NON pushare/deployare e riporta blocco + fix proposto

Comportamento in caso di errore
• Se push o deploy falliscono, l’agente deve tentare correzione immediata (auth/token/comando)
• Se resta bloccato da credenziali o permessi, dichiararlo chiaramente con i soli passi minimi manuali richiesti

Override utente
• Se l’utente scrive esplicitamente “non pushare” / “no deploy”, rispettarlo.
• In assenza di override, publish remoto è parte obbligatoria della definizione di done.

Definizione di done (quando remote esiste)
• Modifica locale + commit + push + deploy + verifica post-deploy completati.

⸻

MEMORIA DI PROGETTO (storico)

Percorso memoria
• bkp/ops/STATUS.md (stato attuale: fotografia dell’adesso)
• bkp/ops/WORKLOG.md (diario cronologico append-only)
• bkp/ops/DECISIONS.md (decision log append-only)
• bkp/ops/journal/ (1 file per step: storico completo)
• bkp/ops/chatlogs/ (log conversazioni/estratti: storico chat)

Timestamp (obbligatorio)

Formato unico: YYYY-MM-DD HH:MM (ora locale)

Regole anti-sovrascrittura
• WORKLOG: append-only (mai riscrivere entry vecchie)
• DECISIONS: append-only (se cambia una decisione, aggiungi una nuova entry e indica “Sostituisce ADR-XXXX”)
• journal/: append-only (mai sovrascrivere file esistenti)
• chatlogs/: append-only (mai sovrascrivere file esistenti)
• STATUS: si aggiorna (è voluto)

Se la memoria non esiste: creala

Se manca bkp/ops/ o file/cartelle: 1. crea bkp/ops/, bkp/ops/journal/, bkp/ops/chatlogs/, bkp/backups/ 2. crea i file con template minimi 3. procedi senza fermarti

Template STATUS.md

Stato progetto

Obiettivo

Fatto

In corso

Prossimo

Rischi

Ultimo aggiornamento

YYYY-MM-DD HH:MM

Template WORKLOG.md

Worklog (append-only)

Template DECISIONS.md

Decision log (ADR light)

⸻

Pre-flight (obbligatorio)

Prima di iniziare un task/step: 1. leggi STATUS + WORKLOG 2. se devi decidere strategie, leggi DECISIONS 3. scrivi 3 righe prima del “Risultato”:
• Dove siamo
• Cosa farai ora
• Prossimo step

Post-flight (obbligatorio)

A fine step: 1. WORKLOG (append) con: timestamp + ruolo + fatto + output chiave + prossimo passo 2. STATUS aggiornato + Ultimo aggiornamento con timestamp 3. DECISIONS (append) se c’è una decisione 4. journal: crea sempre un file:
• bkp/ops/journal/YYYY-MM-DD/HHMM*<ruolo>*<titolo>.md
contenuto minimo: timestamp, ruolo, prompt (riassunto), risultato (riassunto), evidenze, decisioni, next

⸻

ANTI-BLOCCO + WIZARD

Anti-blocco

Se mancano info generiche (standard, security, performance, scope):
• NON fermarti
• usa default dal repo
• dichiara assunzioni in 3–5 righe
• procedi

Vietate meta-query interne

Non usare “get\_\*\_context” / payload JSON fittizi. Se serve input: Wizard.

Wizard (max 6 domande)

Formato:
WIZARD DI CONTESTO
Q1) …
A) … — spiegazione semplice
B) …
C) …
⭐ Consigliato: X — perché
Risposta rapida: 1X
…
Risposta rapida completa: 1A 2B 3A

Se l’utente non risponde al turno successivo: usa ⭐ e procedi dichiarando assunzioni.

⸻

BACKUP DEL CODICE (sempre funzionante)

Obiettivo backup

Avere un ripristino reale del codice:
• Preferenza: snapshot Git (se repo Git esiste)
• Fallback: backup locale in bkp/backups/ (se Git non esiste)

Backup locale (fallback obbligatorio)

Se NON esiste un repository Git (nessuna .git/), allora lo “snapshot” si fa così:
• crea cartella: bkp/backups/YYYY-MM-DD/HHMM\_<breve-descrizione>/
• copia dentro una snapshot del progetto ESCLUDENDO cartelle/file generati o pesanti (lista sotto)
• includi SEMPRE: src/, public/, docs/, e2e/, scripts/, config, package.json, AGENTS.md, bkp/ops/

Esclusioni standard (obbligatorie)

Non copiare MAI questi percorsi (se presenti):
• node_modules/
• dist/
• build/
• out/
• coverage/
• test-results/
• playwright-report/
• reports/ (se contiene output generati)
• .cache/
• .vite/
• .turbo/
• .parcel-cache/
• .next/ (Next.js)
• .nuxt/ (Nuxt)
• .svelte-kit/
• .angular/
• .vercel/
• .netlify/
• .storybook-static/
• tmp/
• temp/
• logs/
• \*.log

Esclusioni per evitare ricorsione (obbligatorie)

Per evitare “backup dentro backup”, non copiare MAI:
• bkp/backups/
• bkp/ops/journal/** (default: ESCLUDI per non duplicare troppo)
• bkp/ops/chatlogs/** (default: ESCLUDI)

Nota: bkp/ops/STATUS.md, WORKLOG.md, DECISIONS.md vanno comunque inclusi SEMPRE.

File-spazzatura OS/editor (consigliate)

Escludi:
• .DS_Store
• Thumbs.db
• .idea/ (JetBrains) (a meno che tu voglia salvarla)
• .history/

Nota: se il progetto è enorme, al posto della copia puoi creare un archivio .zip dentro la stessa cartella backup.

⸻

Comando manuale: SNAPSHOT (sempre disponibile)

Se l’utente scrive:
• SNAPSHOT
• BACKUP CODICE

Allora: 1. Se esiste .git/:
• crea branch backup/YYYY-MM-DD*HHMM*<descrizione>
• commit: backup: snapshot before <descrizione> 2. Se NON esiste .git/:
• esegui Backup locale in bkp/backups/YYYY-MM-DD/HHMM\_<descrizione>/ 3. Termina con: STOP (attendo conferma per proseguire)

⸻

SALVATAGGIO MEMORIA (versionato)

Comando manuale: MEMORIA

Se l’utente scrive:
• MEMORIA
• SALVA MEMORIA

Allora: 1. Esegui Pre-flight 2. Esegui Post-flight (WORKLOG/STATUS/DECISIONS/journal) con timestamp 3. Se esiste .git/: commit dei file memoria (opzionale ma consigliato) 4. STOP

⸻

CHECKPOINT (salva tutto)

Comando manuale: CHECKPOINT

Se l’utente scrive:
• CHECKPOINT
• SALVA TUTTO

Allora: 1. Esegui MEMORIA 2. Esegui SNAPSHOT (Git se possibile, altrimenti backup locale) 3. STOP

⸻

CHATLOG (storico conversazione)

A cosa serve bkp/ops/chatlogs/

Serve a salvare pezzi di conversazione (o riassunti) con timestamp, così puoi:
• riprendere in una chat nuova senza perdere dettagli
• avere “prove” di decisioni/prompt usati
• dare contesto a un nuovo agente senza incollare 2000 righe in chat

Salvataggio chatlog automatico (obbligatorio)

Alla fine di ogni step (Post-flight), crea SEMPRE anche un chatlog sintetico:
• bkp/ops/chatlogs/YYYY-MM-DD/HHMM_chatlog.md
Contenuto minimo:
• timestamp
• ruolo (path ruolo aperto)
• riassunto (10–20 righe)
• decisioni prese / next step
• eventuali prompt chiave (riassunti)

Comando manuale: CHATLOG

Se l’utente scrive:
• CHATLOG
• SALVA CHAT

Allora: 1. Crea un file: bkp/ops/chatlogs/YYYY-MM-DD/HHMM_chatlog.md 2. Inserisci contenuto come sopra (più eventuale testo incollato dall’utente) 3. STOP

⸻

RIPRENDI (nuova chat)

Comando manuale: RIPRENDI

Se l’utente scrive:
• RIPRENDI
• RIPARTI
• BOOTSTRAP

Allora: 1. Leggi STATUS/WORKLOG/DECISIONS (+ ultimo journal + ultimo chatlog se presenti) 2. Riassumi 8–12 righe (dove siamo / fatto / in corso / prossimo) 3. Proponi prossimo ruolo + prompt pronto 4. STOP
