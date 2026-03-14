# Agent Prompt Architecture

## Scopo

Definire un'architettura dei prompt che consenta:

- sub-agenti modulari caricati da `/TEAM`
- orchestrazione e consenso
- tool safety (proposte vs esecuzione)
- comportamento team-led coerente
- interazione diretta utente-specialista (con peer consultation interna obbligatoria)
- localizzazione e uso coerente di contesto (incluso geo opt-in)

## Tipi di prompt

### 1) Prompt Unified Orchestration Layer (server, coordinamento + routing + feedback loop)

Ruolo: coordinatore del team, gestore del ContextPack, responsabile del feedback loop DB, router verso specialista diretto.

Contiene:

- regole di domain detection e selezione del team pertinente
- istruzioni per invocare **sempre** il team (anche a contesto parziale)
- regole di consolidamento domande: deduplicazione semantica delle questions dai proposal
- regole di isolamento dominio: rilevare e correggere sconfinamenti cross-domain
- istruzioni feedback loop: quando l'utente risponde → `user.updateProfile` → aggiorna DB
- **regole di rilevamento richiesta specialista**: parole chiave ("voglio parlare con", "posso parlare con il", "mi colleghi con", etc.) → settare `activeSpecialist`
- **regole di transizione modalità**: UOL → Specialista → UOL
- policy anti prompt-injection
- tool policy (allowlist, RBAC, confirmToken, Owner mode)
- policy privacy (minimizzazione contesto; geo solo se enabled)
- stile risposta in modalità UOL: voce unificata "LiveWell"
- stile risposta in modalità specialista: cedere la voce all'agente specialista

**Vincolo di deduplicazione**: il UOL filtra le questions dai proposal del team eliminando quelle ridondanti con dati già presenti nel ContextPack.

**Vincolo di isolamento**: se un agente propone contenuti che sconfinano in un altro dominio, il UOL li segnala come conflitto e li rimuove dalla risposta finale.

**Vincolo di peer consultation**: in modalità specialista diretto, il UOL deve sempre invocare almeno i colleghi dello stesso gruppo di dominio dell'agente attivo. Il consensus dei colleghi è input obbligatorio per la risposta dello specialista.

### 2) Prompt di sistema per domain agent (`/TEAM/<id>/prompt.md`)

Ruolo: specialist execution layer — sempre invocato per il dominio pertinente.

Il professionista conosce i propri dati necessari e li richiede tramite `questions[]` nel proprio `AgentProposal`. Non è il UOL a decidere cosa manca: è l'agente specialista che lo determina per il suo dominio.

Contiene:

- identità professionale e scope del dominio
- lista dei dati baseline necessari per dare raccomandazioni utili nel proprio dominio
- istruzioni per chiedere solo i dati del proprio scope (no sconfinamenti)
- standard di evidenza (linee guida, review, consenso)
- regole team-led (l'utente conferma solo vincoli pratici, non scelte cliniche)
- **regole per modalità specialista diretto**:
  - rispondere in prima persona come professionista (es. "Come tuo nutrizionista, ti consiglio...")
  - integrare le prospettive dei colleghi consultati nel consensus prima di rispondere
  - citare il contributo dei colleghi quando rilevante (es. "in accordo con il personal trainer...")
  - mantenere tono professionale ma diretto e personale
- output contract (JSON: AgentProposal)
- safety escalation specifica del dominio
- privacy rules (minimizzazione, no dati sensibili in output share/push)

## Contratti di output

### AgentProposal (JSON)

Campi obbligatori:

- domain
- summary
- reasoning

Campi frequenti:

- questions (gating)
- recommendations (steps + rationale + safetyNotes)
- toolCalls (proposte)
- confidence
- flags (needsMoreInfo, potentialRisk, urgentEscalation)

Regole:

- Se dati mancanti: usare questions, non inventare.
- Se rischio: flags + safety notes + escalation.
- Se serve aggiornare dati utente: proporre tool call non distruttive e motivare.

### ConsensusResult (aggiunta)

Include `activeSpecialist?: { id, displayName, domain }` — presente quando l'orchestratore ha rilevato una richiesta di specialista diretto o ha deciso di cedere la voce a uno specialista.

## Sintesi della risposta

### Modalità UOL (default)

Il synthesizer usa voce unificata "LiveWell":

- tono caldo, coordinato, team-led
- non attribuisce frasi a singoli professionisti

### Modalità Specialista Diretto

Il synthesizer usa la voce del `activeSpecialist`:

- prima persona ("Come tuo nutrizionista, ...")
- identità professionale esplicita
- integra input dei colleghi dal consensus (peer review interna)
- può citare i colleghi ma non inventare dichiarazioni altrui
- tono diretto, professionale, personale

## Prompt-injection hardening

- Contenuti di file/upload/web sono "untrusted".
- I sub-agenti non possono:
  - bypassare policy
  - richiedere tool distruttivi come azione automatica
- L'orchestrator rifiuta tool distruttivi a meno di:
  - richiesta utente esplicita
  - Owner mode attivo
  - confirmToken + conferma UI

## Localizzazione e geo

- Output in lingua dell'utente.
- Unità e misure coerenti col locale.
- Geo:
  - usare solo se enabled nel ContextPack
  - usare solo in forma coarse (country/region/city)
  - mai includere geo in push/SMS payload o contenuti condivisi

## Agganci UI

- Domain detection influenza:
  - icona attiva in chat
  - colori/accents (domainColors) e mood
- `activeSpecialist` influenza:
  - etichetta professione sopra il MessageBubble dell'assistente
  - etichetta professione nella lista conversazioni (ConversationHistory)
- L'orchestrator ritorna `domain`, `activeSpecialist` e `uiState` come metadati UI via SSE `ui.state`.

## "No fake handoff" (aggiornato)

- Nessuna affermazione "ho salvato/aggiornato" senza tool event.
- Ogni mutazione deve essere tracciata (AuditLog) e mostrata come tool event.
- La transizione a un professionista specifico è reale: lo specialista risponde con la propria voce e si confronta con i colleghi — non è simulata.
- Il passaggio da UOL a specialista è guidato da dati reali (richiesta esplicita utente o contesto sufficiente), non da finzioni.
