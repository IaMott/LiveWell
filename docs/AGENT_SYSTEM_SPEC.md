# LiveWell — Agent System Spec

## Obiettivo
Team di agenti professionali reali (componenti separati) coordinati da un **Unified Orchestration Layer** che funge da intake intelligente e router. L'interazione principale è tramite chat; il profilo rendiconta il processo e lo storico. L'utente può interagire direttamente con i singoli professionisti; i professionisti si consultano sempre con i colleghi pertinenti prima di rispondere.

## Modalità di interazione

### Modalità UOL (default — intake + coordinamento)
Il Unified Orchestration Layer risponde con voce unificata "LiveWell". Usata per:
- Primo intake e raccolta dati iniziale
- Domande multi-dominio senza specialista chiaro
- Messaggi generali o di riepilogo

### Modalità Specialista Diretto
L'utente chiede esplicitamente di parlare con un professionista specifico (es. "voglio parlare con il nutrizionista", "posso parlare con il medico?") oppure il contesto è sufficientemente ricco per cedere la parola a uno specialista.

In questa modalità:
- Il professionista risponde **in prima persona** con la propria voce e identità professionale.
- Prima di rispondere, lo specialista **deve consultare internamente i colleghi** del proprio ambito o dei domini correlati alla conversazione (consensus interno). Può citare i colleghi nella risposta.
- Il Unified Orchestration Layer fa da router, non da voce.
- La storia delle conversazioni mostra il nome della professione sopra il testo del messaggio.
- L'`activeSpecialist` è incluso nel `ConsensusResult` e trasmesso via SSE `ui.state`.

**Regola di peer consultation obbligatoria**: prima di qualsiasi raccomandazione o "diagnosi", lo specialista attivo consulta via consensus i colleghi del proprio gruppo (es. il Dietista consulta Chef e Endocrinologo) e, se la domanda ha dimensioni cross-dominio, anche specialisti di aree correlate. Solo dopo integra le loro prospettive nella risposta.

**Transizione UOL → Specialista**:
- L'utente chiede esplicitamente uno specialista → transizione immediata.
- Oppure: dopo N turni di intake e raccolta dati sufficiente → UOL può cedere la parola con una frase di introduzione.

**Transizione Specialista → UOL**:
- L'utente cambia argomento fuori dal dominio dello specialista → UOL riprende il controllo.
- L'utente dice "torna a LiveWell" o simile.

## Componenti

### Unified Orchestration Layer (coordinamento + routing + feedback loop — ruolo unico)
Sostituisce definitivamente il precedente modello con Orchestrator e Interviewer separati.

Responsabilità:
- Costruire il ContextPack e rilevare il dominio.
- Selezionare e invocare **sempre** il team di agenti pertinente — anche a contesto parziale.
  _(Sono i professionisti stessi a sapere quali dati servono per la loro analisi.)_
- Garantire isolamento di dominio: ogni agente risponde solo per il proprio campo.
- Raccogliere le domande dai proposal del team e deduplicate semanticamente.
- Presentare all'utente solo le domande strettamente necessarie (mai ridondanti con dati già noti).
- Quando l'utente risponde: salvare i nuovi dati nel profilo DB (`user.updateProfile`) prima del turno successivo.
- Coordinare consensus, tool execution e streaming.
- **Rilevare richieste di specialista diretto** e settare `activeSpecialist` nel `ConsensusResult`.
- In modalità specialista diretto: cedere la sintesi all'agente specialista (voce in prima persona).

**Invariante**: i domain agents vengono sempre invocati (anche in modalità specialista). Il UOL non è un gate — è il coordinatore che garantisce che la risposta del singolo specialista sia arricchita dal consensus dei colleghi.

### Domain Teams (specialist execution layers — collaborazione parallela)
- Caricati da `/TEAM`, 5 aree: Nutrition, Training, Health, Mindfulness, Inspiration.
- **Sempre invocati** in parallelo per il dominio rilevato.
- In **modalità specialista diretto**: l'agente con `id` corrispondente all'`activeSpecialist` compone la risposta finale in prima persona; le proposte degli altri agenti contribuiscono come peer review interna.
- Isolamento garantito: ogni agente propone solo per il proprio dominio.
- Ogni agente ha prompt, toolsAllowed, escalationRules, disclaimerStyle.
- Output: `AgentProposal` (domain, summary, reasoning, questions, recommendations, toolCalls, confidence, flags).

### Consensus Engine
- Riceve `AgentProposal[]` dai domain agents.
- Unisce proposte rispettando l'isolamento di dominio, rileva conflitti cross-domain.
- Deduplica le domande di gating **semanticamente** (non solo per stringa uguale).
- Produce output team-led unico.
- In modalità specialista diretto: il consensus alimenta la risposta dello specialista (peer review interna), non sostituisce la sua voce.

### ContextPack Builder
- Contesto dal DB: profilo, storico, tracker, file, notifiche, optional geo.
- Usato dal Unified Orchestration Layer come prima operazione del lifecycle.

### Tool Execution Engine
- allowlist + RBAC + audit + confirm token (server-only).

### Domain Detection
- Keyword classifier + opzionale LLM hint.
- Output: domain principale per agent selection, UI icon highlight, e routing specialista.

## TeamLoader
Layout cartella TEAM (server-only):
`/TEAM/<agent-id>/`
- `profile.json`
- `prompt.md`
- `capabilities.md` (opzionale)

profile.json (schema):
- id: string
- displayName: string
- domainTags: ["nutrition" | "health" | "training" | "mindfulness" | "inspiration" | "general"]
- systemPromptPath: "prompt.md"
- toolsAllowed: string[]
- escalationRules: string[]
- disclaimerStyle: "concise" | "standard" | "strict"
- decisionStyle: "team-led"

Validazione:
- Zod schema server-side
- In dev: fallback agent se TEAM vuota/invalid

## ContextPack Builder
Scopo: fornire dati utili senza esporre segreti o contenuti non necessari.

Contenuto minimo:
- user: id, role
- profile/settings: dati strutturati + preferenze UI
- history: ultimi messaggi + artifacts recenti (limitati)
- trackers: ultimi 7 giorni (trend e score)
- notifications: unreadCount, lastSentAt
- files: riferimenti + extractedText (quando utile)
- ui: moodScore + sectionScores
- geo (solo se enabled): country/region/city + timezone (opzionale) + coordinates arrotondate (opzionale)

Regole privacy:
- Non includere env vars, token, segreti
- Riassumere dove possibile e limitare testo

## Geolocation usage (privacy-first)
- Geo presente nel ContextPack **solo** se:
  - geoPreference.enabled == true
- Geo è coarse per default (country/region/city o coords arrotondate)
- Geo non deve finire in:
  - push/SMS payloads
  - share links/public pages

Uso permesso:
- normative locali
- unità/locale
- contesto etichette/availability alimenti
- guidance generale (non personal medical decision basata su coordinate precise)

## Domain Detection
- Determina dominio principale per agent selection e UI icon highlight.
- Output:
  - domain: nutrition|health|training|mindfulness|inspiration
  - opzionale: domainScores

Implementazione:
- keyword classifier fallback
- opzionale LLM classifier server-side con guardrail

## Consensus Engine
Input:
- AgentProposal[]
- domainHint
- contextPack
- tool allowlist orchestrator

Output:
- finalMessageMarkdown (team-led o specialist-voice)
- gatingQuestions (se mancano dati)
- proposedToolCalls (allowlisted)
- uiState (domainIcon + moodScore + sectionScores)
- safety (disclaimer/escalation)
- artifactsToSave (piani/ricette/schede/consigli)
- **activeSpecialist** (opzionale: { id, displayName, domain } — presente in modalità specialista diretto)

Team-led enforcement:
- il team propone raccomandazioni
- l'utente conferma solo vincoli pratici e preferenze non cliniche
- se l'utente impone scelte non sostenibili: rifiuto + alternative

## Tool execution model
Principio: nessun accesso diretto a DB/filesystem/env vars.

Pipeline:
1) LLM propone toolCalls[] (name + args)
2) Server ToolRegistry:
   - allowlist + zod validate
   - RBAC
   - rate limit + idempotency (se sensibile)
   - audit log obbligatorio per mutazioni
3) Distruttivi:
   - step 1: confirmToken + richiesta conferma utente
   - step 2: esegue con confirmToken
   - richiede Owner mode attivo

Tool events in chat:
- ogni tool executed produce evento visibile (solo se successo o richiesta conferma — gli errori tecnici non vengono mostrati all'utente).

Geo tools:
- geo.setPreference({ enabled })
- geo.updateCoarseLocation({ country, region, city, timezone?, lat?, lon?, accuracy? })
- geo.clearLocation()

Vincoli:
- updateCoarseLocation solo se enabled
- sempre audit log
- mai in push/SMS/share

## Memoria e storico
- Persistenza DB: Conversation, Message (con domain), FileAsset, Plans, Artifacts, Tracker entries, Notifications, AuditLog
- Il campo `domain` su Message identifica lo specialista che ha risposto per ogni turno.
- Orchestrator usa:
  - ultimi messaggi
  - artifacts recenti
  - trend/score
  - geo (se enabled)
- Nessuna memoria nascosta: tutto tracciato e consultabile.
- La lista conversazioni include `specialist` (nome professione) ricavato dall'ultimo messaggio assistente.

## ActiveSpecialist in ConsensusResult
```typescript
activeSpecialist?: {
  id: string          // agent id (es. "dietista", "persona-trainer")
  displayName: string // nome visualizzato (es. "Dietista", "Personal Trainer")
  domain: Domain      // dominio primario
}
```
- Incluso in `ui.state` SSE event.
- Persisted come `domain` sul Message assistente nel DB.
- Mostrato in MessageBubble come etichetta sopra il testo.
- Mostrato in ConversationHistory come professione sotto il titolo conversazione.

## Modello Gemini
- Provider astratto
- free vs pro in base a subscription
- risoluzione "latest stable" tramite mapping controllato e testato (no auto-update non verificato)
