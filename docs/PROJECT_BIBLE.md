# PROJECT BIBLE — Invariants & Runtime Contracts

Questo documento definisce le **regole invarianti del sistema** e i **contratti runtime** che non devono essere violati dal codice.

Non descrive:

- il comportamento di prodotto
- l’architettura tecnica
- la logica degli agenti

Questi aspetti sono definiti in:

- `PRD.md`
- `ARCHITECTURE.md`
- `AGENT_SYSTEM_SPEC.md`

Questo file contiene solo **regole fondamentali che devono rimanere sempre vere**.

---

# 1. Gerarchia dei documenti (Source of Truth)

Ordine di autorità dei documenti:

1️⃣ **AGENTS.md**  
Source of truth assoluta per workflow di sviluppo e regole operative degli agenti di coding.

2️⃣ **PRD.md**  
Descrive cosa deve fare il prodotto e i vincoli UX/behavior.

3️⃣ **ARCHITECTURE.md**  
Descrive come è costruito il sistema.

4️⃣ **AGENT_SYSTEM_SPEC.md**  
Descrive il sistema di orchestrazione e collaborazione tra agenti.

5️⃣ **PROJECT_BIBLE.md**  
Definisce solo invarianti e contratti runtime.

Se esiste un conflitto tra documenti:

- prevale sempre **AGENTS.md**

---

# 2. Principio fondamentale: Chat-First System

L'interazione utente avviene **solo tramite chat**.

L’utente non compila manualmente l’applicazione.

Tutti i dati dell’app vengono:

- raccolti
- interpretati
- salvati
- aggiornati

dagli agenti tramite il sistema di **Tool Execution**.

Il resto dell’app serve solo per:

- visualizzare
- rendicontare
- condividere
- esportare

le informazioni generate tramite chat.

---

# 3. Team di Agenti Reali (No Fake Personas)

Gli specialisti non sono “personaggi simulati”.

Sono **agenti separati e indipendenti** che collaborano tramite orchestratore.

L'orchestratore non deve mai simulare specialisti.

È vietato generare messaggi come:

"Passo la parola al nutrizionista"
"Il mio collega allenatore dice..."

Ogni risposta deve indicare chiaramente l’autore reale.

Esempio corretto:

[Nutrizionista]
Suggerisco di aumentare leggermente le proteine a colazione.

---

# 4. Nessun Hardcode degli Agenti

Gli agenti specialisti **non possono essere hardcoded nel codice**.

Devono essere caricati dinamicamente da:

/TEAM/<agent-id>/

Ogni agente è definito da:

profile.json
prompt.md

Il caricamento è gestito dal **TeamLoader** definito in:

AGENT_SYSTEM_SPEC.md

L’interfaccia utente e il sistema devono leggere le informazioni sugli agenti **dal registry runtime**, non da mapping statici.

---

# 5. Tool Execution Safety

Gli agenti **non hanno accesso diretto** a:

- database
- filesystem
- variabili d’ambiente
- storage

Ogni modifica deve passare tramite **Tool Execution Server-Side**.

Regole obbligatorie:

- allowlist tool
- validazione schema
- RBAC
- audit log
- rate limit
- confirm token per azioni distruttive

Queste regole non possono essere bypassate.

---

# 6. Audit Obbligatorio

Qualsiasi modifica ai dati utente deve essere tracciata.

Esempi:

- aggiornamento profilo
- creazione piano alimentare
- log allenamento
- modifica dati salute
- creazione ricette
- aggiornamento obiettivi

Ogni evento genera:

AuditLog

con:

- userId
- agentId
- toolName
- timestamp
- payload sintetico

---

# 7. Streaming Runtime Contract (Chat)

Le risposte della chat devono essere inviate tramite streaming.

Il sistema deve supportare eventi strutturati.

Eventi possibili:

routing
agent_turn
agent_delta
tool_event
assistant_message
error
done

Questo consente alla UI di:

- mostrare chi sta parlando
- aggiornare il testo progressivamente
- mostrare eventi tool
- gestire stato conversazione

---

# 8. UI Topic Signal

Il sistema può emettere eventi semantici per l’interfaccia.

Esempio:

TopicState

che indica il dominio della conversazione.

La UI usa questo evento per:

- evidenziare l’icona del dominio
- aggiornare lo stato visivo della chat

Questo meccanismo non deve dipendere dalla UI ma dal runtime agent system.

---

# 9. Privacy e Sensibilità dei Dati

Non devono essere inviati dati sensibili tramite:

- notifiche push
- SMS
- link pubblici

I link condivisi devono essere:

- read-only
- revocabili
- con token non indovinabile

---

# 10. Guardrail Salute

Gli agenti non possono:

- fare diagnosi
- prescrivere trattamenti medici
- sostituire professionisti reali

Se emergono segnali di rischio serio:

- l’agente deve attivare un messaggio di sicurezza
- invitare a contattare un professionista reale o emergenza.

---

# 11. Regola di Stabilità del Sistema

Qualsiasi modifica al sistema deve preservare queste invarianti:

- chat-first interaction
- team di agenti reali
- nessun hardcode degli specialisti
- tool execution sicuro
- audit obbligatorio
- streaming runtime contract

Se una modifica rompe uno di questi principi,
la modifica è considerata **non conforme al progetto**.
