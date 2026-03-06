# AGENT SYSTEM SPEC — Team of Agents + Orchestrator + Tool Execution

Questo documento definisce come funziona il sistema agentico dell'app.

Descrive:

- orchestratore
- agenti specialisti
- team loader
- tool execution model
- context retrieval
- runtime pipeline

Non descrive:

- UX del prodotto → vedere PRD.md
- architettura tecnica → vedere ARCHITECTURE.md
- struttura dei prompt → vedere AGENT_PROMPT_ARCHITECTURE.md

AGENTS.md rimane la **source of truth assoluta per workflow e regole operative di sviluppo**.

---

# 1. Concetti fondamentali

Il sistema è composto da:

**Orchestrator Agent**

coordina il team e produce la risposta finale.

**Specialist Agents**

professionisti AI indipendenti caricati dinamicamente da `/TEAM`.

**Tool Execution Layer**

sistema server-side che permette agli agenti di modificare dati applicativi in modo sicuro.

L’utente interagisce **solo tramite chat**.

Il resto dell'app rende visibili i risultati del lavoro del team.

---

# 2. Team Loader

Gli agenti specialisti non possono essere hardcoded.

Devono essere caricati da filesystem.

/TEAM/<agent-id>/

Ogni agente contiene:

profile.json
prompt.md

profile.json schema:

{
"id": "string",
"displayName": "string",
"domainTags": ["nutrition","training","health","mindfulness","inspiration"],
"systemPromptPath": "./prompt.md",
"toolsAllowed": ["tool.name.*"],
"escalationRules": [],
"disclaimerStyle": "standard",
"decisionStyle": "team-led"
}

Il loader:

- legge filesystem
- valida schema con zod
- registra agent nel TeamRegistry.

Fallback dev:

GenericSpecialistAgent se `/TEAM` è vuota.

---

# 3. Orchestrator Pipeline

Input:

- user message
- file allegati
- context pack
- impostazioni utente
- subscription tier

Pipeline:

### 1 Intent detection

classifica il dominio della conversazione.

### 2 Domain routing

seleziona specialisti rilevanti.

### 3 Gating

se mancano dati critici chiede domande mirate.

### 4 Consensus loop

richiede analisi agli specialisti.

### 5 Tool planning

decide quali tool invocare.

### 6 Tool execution

esegue mutazioni server-side.

### 7 Final response

compone la risposta finale.

---

# 4. Tool Execution Model

Gli agenti non hanno accesso diretto a:

- database
- filesystem
- environment variables

Devono usare tool server-side.

Regole:

- allowlist tool
- schema validation
- RBAC
- audit log
- rate limit
- confirm token per azioni distruttive.

---

# 5. Auto-compilazione dati

L'app è **chat-first**.

Se l'utente comunica un dato strutturabile:

esempio:

"Mi chiamo Marco"

l'orchestratore può invocare:

user.updateProfile({name:"Marco"})

Se la confidenza è bassa:

chiede conferma.

---

# 6. Context Retrieval

Gli agenti non accedono al database.

Ricevono un **Context Pack** costruito server-side.

Contiene:

- profile snapshot
- conversation summary
- ultimi messaggi
- trend metrics
- artefatti recenti

Il contesto è limitato per ridurre token cost.

---

# 7. Tool Set

Esempi di tool:

user.updateProfile  
health.addMetric  
nutrition.logMeal  
nutrition.createFoodItem  
training.logWorkoutSession  
mindfulness.createEntry  
inspiration.createEntry  
artifacts.saveRecommendation  
notifications.createInApp  
share.createLink  
export.pdf

Azioni distruttive richiedono confirmToken.

---

# 8. Notifiche

Le notifiche non sono log della chat.

Sono comunicazioni proattive degli specialisti.

Canali:

- in-app
- push web (opt-in)
- sms opzionale via provider

---

# 9. Model Resolver (Gemini)

Il sistema non usa una versione statica.

Un componente server chiamato **LatestModelResolver** seleziona:

- modello free
- modello pro

in base alla subscription.

Configurazione:

GEMINI_MODEL_FREE
GEMINI_MODEL_PRO

Fallback automatico se il modello non è disponibile.

---

# 10. UI Event Signals

L'orchestratore può emettere eventi per la UI.

TopicState:

indica il dominio della conversazione.

Usato per accendere le icone (stroke verde).

MoodState:

stato globale progresso utente.

Usato per UI viva.

---

# 11. Guardrail Salute

Gli agenti non possono:

- fare diagnosi
- prescrivere trattamenti
- sostituire professionisti reali.

Se emergono segnali gravi:

il sistema attiva escalation.
