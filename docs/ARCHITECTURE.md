# LiveWell — Architecture

## Stack
- Next.js (App Router) + TypeScript
- UI: TailwindCSS + shadcn/ui (Radix) + custom SVG icons
- State: TanStack Query (data fetching), Zustand opzionale
- DB: Postgres + Prisma
- Auth: NextAuth (Auth.js)
- Storage: Supabase Storage (file)
- Realtime signaling: Supabase Realtime (channels)
- AI: Gemini via server proxy, provider astratto (gemini|mock)
- Streaming: SSE / fetch streaming (server -> client)
- Cron: Vercel Cron -> route handler
- PDF export: server-side generator

## Struttura cartelle (macro)
- /src/app
  - /(app)/page.tsx (chat)
  - /(app)/profile/* (dashboard domini e rendicontazione)
  - /api/* (route handlers)
- /src/components
  - /app (shell/chat/profile/settings)
  - /ui (design system)
- /src/lib
  - /db (prisma client + adapter)
  - /auth
  - /ai (providers/orchestrator/agents/tools/context/consensus/domain)
  - /realtime
  - /storage
  - /notifications
  - /export (pdf)
  - /validators (zod)
  - /security (rate limit, csrf policy se necessario)
  - /geo (privacy-first geolocation helpers)
  - /ui (icon registry, domain colors, mood utilities)
- /TEAM (server-only agent profiles/prompts; loaded at runtime)
- /design (icons + reference images)

## Unified Orchestration Layer (decisione architetturale vincolante)

**Non esistono Orchestrator e Interviewer come ruoli separati.**
Esiste un unico **Unified Orchestration Layer** (UOL) che coordina il team, gestisce il routing e garantisce il feedback loop DB.

Responsabilità esclusive:
1. Costruire il ContextPack (DB + messaggi + tracker + geo opt-in).
2. Rilevare il dominio rilevante (5 aree: Nutrition, Training, Health, Mindfulness, Inspiration).
3. Selezionare e invocare **sempre** il team di agenti pertinente — anche a contesto parziale.
4. Raccogliere le domande di gating dai proposal degli agenti e deduplicate semanticamente.
5. Presentare all'utente solo le domande realmente necessarie (mai ridondanti con dati già noti).
6. Quando l'utente risponde: salvare i nuovi dati nel profilo DB (`user.updateProfile`) **prima** del turno successivo.
7. Garantire isolamento di dominio: ogni agente risponde solo per il proprio campo.
8. Coordinare consensus, tool execution e streaming della risposta finale.

**Principio fondamentale:** I domain agents vengono **sempre** invocati perché sono loro a sapere quali dati servono per la loro analisi. Il UOL non blocca il team — lo coordina e mantiene il contesto aggiornato nel tempo.

I **5 domain team** (Nutrition, Training, Health, Mindfulness, Inspiration) sono **specialist execution layers** che lavorano in parallelo, collaborano sull'output e non sconfinano l'uno nel dominio dell'altro.

## Request flow: Chat send + streaming

```
User Request
  ↓
[Unified Orchestration Layer — coordinamento continuo]
  1. Build ContextPack (DB + history + trackers + geo)
  2. Domain Detection
  3. Select relevant domain team (agenti del dominio rilevato)
  4. Run agents in parallel → AgentProposal[]
     (ogni agente conosce i propri dati necessari e li richiede via questions[])
  5. Consensus Engine:
     - Merge proposals (isolamento dominio garantito)
     - Deduplica questions semanticamente (non solo per stringa uguale)
     - Conflict detection cross-domain
  6. SE il team ha domande:
     → Presenta targeted questions consolidate all'utente
     → Quando l'utente risponde: user.updateProfile → salva in DB
     → Turno successivo: ContextPack aggiornato → agenti vanno più in profondità
  7. SE il team ha raccomandazioni:
     → Tool execution (RBAC + AuditLog + confirmToken)
     → Stream SSE: message.delta / tool.result / ui.state / message.complete
  8. Salva messaggio assistant in DB (domain, mood, artifacts)
```

**Feedback loop continuo (invariante):**
- Ogni risposta dell'utente aggiorna il profilo DB prima del turno successivo.
- Il ContextPack si arricchisce progressivamente: gli agenti approfondiscono ad ogni turno.
- Le domande ridondanti vengono eliminate dal UOL: conosce cosa è già stato raccolto.
- Il team lavora in parallelo su più fronti: la convergenza garantisce qualità e copertura.

## HTTP flow (dettaglio)
1) Client -> POST `/api/chat/send`
2) Server:
   - salva messaggio utente (DB)
   - costruisce ContextPack (DB + messaggi + tracker + optional geo)
   - domain detection
   - seleziona + invoca domain agents in parallelo
   - consensus: merge proposals, deduplicazione semantica domande, conflict detection
   - se domande: presenta all'utente + propone `user.updateProfile` per le risposte
   - se raccomandazioni: esegue tool (RBAC/audit/confirm) + stream SSE
3) Server salva messaggio assistant (DB) con metadata (domain, mood, artifacts)

## Tool execution model (server)
- LLM non vede DB, filesystem, env vars.
- LLM può solo proporre tool calls (nome + args).
- Server:
  - zod validate
  - RBAC
  - AuditLog
  - confirmToken + Owner mode per distruttivi
  - tool event visibile in chat

## Storage file
- Upload via route `/api/files/upload`
- Supabase Storage + FileAsset in DB
- Extracted text/metadata server-side
- Orchestrator riceve riferimenti + testo estratto (no binari enormi)

## Realtime + Live
- Supabase Realtime:
  - channel `conversation:{id}` scambio SDP/ICE per WebRTC
- Live pipeline:
  - audio: WebRTC + trascrizione lato client -> invio chunk testuali
  - video: snapshot a intervalli -> analisi asincrona

## Geolocation (privacy-first)
- Client:
  - toggle in settings
  - navigator.geolocation permission request
  - invio a server endpoint (e.g. POST /api/geo/update)
- Server:
  - normalizza a coarse location (country/region/city o coords arrotondate)
  - persistenza in UserSettings/GeoLocation
  - audit log per set/update/clear
- ContextPack include geo **solo** se enabled.

Invarianti:
- No precise location by default
- No geo in push/SMS payloads
- No geo in share links

## Responsive
- Layout usa `100dvh` + safe-area inset
- Chat:
  - top bar fixed
  - list scroll
  - composer sticky
- Profile dashboards:
  - stessa grammatica UI (cards + donut metrics)
  - mobile: 1 col, tablet/desktop: 2 col grid
  - nessun clipping grafici

## Security
- Rate limiting su: `/api/chat/send`, upload, tool endpoints, share, export, geo endpoints
- Input validation (zod)
- Anti prompt-injection: file/web text non attiva tool distruttivi
- Share links: token non indovinabile, revoca + scadenza

## Observability
- Logging JSON server-side
- Error boundary UI
- Sentry opzionale