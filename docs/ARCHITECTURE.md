# ARCHITECTURE — LiveWell (Next.js + Agents + Tooling)

## 1) Stack (vincolante)

- Next.js (App Router) + TypeScript
- UI: Tailwind + shadcn/ui + Radix + lucide-react
- State: TanStack Query (server state), Zustand opzionale (UI state)
- DB: Postgres (Supabase o Neon) + Prisma
- Auth: scegli 1 e implementa end-to-end:
  - NextAuth (Auth.js) oppure Supabase Auth
- Storage file: Supabase Storage oppure S3 compatibile (1 scelta)
- Realtime: Supabase Realtime / Ably / Pusher (1 scelta)
- Deploy: Vercel

## 2) Architettura “Chat-First”

### 2.1 Principio operativo

- L’unico punto di input dell’utente è la chat.
- Il resto delle UI:
  - mostra dati e grafici
  - espone share/export
  - offre settings
- La compilazione/aggiornamento dei parametri (nome, misure, preferenze, ecc.) è eseguita tramite tool server-side invocati dagli agenti.

## 3) Struttura cartelle (consigliata)

- /src/app
  - /(app)/page.tsx (chat)
  - /(app)/profile/\*\* (sottopagine)
  - /(app)/share/[token]/page.tsx (read-only)
  - /api/\*\* (route handlers)
- /src/components
  - /app (chat, profile, shell)
  - /ui (design system)
- /src/lib
  - /db (prisma client)
  - /auth
  - /ai
    - /providers (Gemini, Mock)
    - /orchestrator
    - /team (loader, schema, registry)
    - /tools (registry, rbac, audit, confirm)
    - /memory (context loader)
  - /realtime
  - /storage
  - /notifications
  - /export (pdf)
  - /ui
    - /tokens
    - /mood (global + section progress state)
    - /icons (topic highlight logic)
  - /validators (zod schemas)

## 4) Data Model (MVP)

### 4.1 Core

- User (role: OWNER|ADMIN|USER, subscriptionTier: FREE|PRO)
- UserProfile (nome, ecc.)
- Conversation, Message
- FileAsset (storage refs)
- Notification (in-app)
- AuditLog (tool calls)

### 4.2 Domains

- Health: MedicalInfo, BodyMetricEntry
- Nutrition: FoodItem, Meal, MealItem, NutritionPlan, GroceryList, GroceryListItem, Recipe (+ ingredients/steps)
- Training: WorkoutPlan, WorkoutSession, Exercise, WorkoutExercise (+ timers metadata)
- Mindfulness: MindfulnessEntry, MindfulnessRecommendation
- Inspiration: InspirationEntry
- Artifacts: RecommendationArtifact (link a conversation, type, content markdown)
- Share: ShareLink (resourceType, resourceId, token, expiresAt, revokedAt)
- Push: PushSubscription (endpoint, keys, userId)

## 5) Request flow (Chat)

1. UI invia message -> `POST /api/chat/send`
2. Server:
   - salva Message utente
   - carica contesto (profilo + ultimi N messaggi + dati rilevanti)
   - invoca orchestratore
3. Orchestratore:
   - routing ambito (icons highlight + domain tags)
   - selezione sub-agent dal TeamRegistry
   - consensus loop
   - propone tool calls (solo allowlist)
4. Tool Executor (server):
   - valida input (zod)
   - RBAC
   - audit log
   - conferma 2-step se distruttivo
   - esegue mutazioni DB
5. Server:
   - stream risposta finale (SSE/fetch streaming)
   - salva Message agente
   - crea eventuali Artifact / Notification

## 6) Context & “historical data”

### 6.1 Context Loader (server-only)

Il contesto che gli agenti “vedono” deriva da:

- UserProfile + sezioni (health/nutrition/training/mindfulness/inspiration)
- ultimi messaggi conversazione
- ultimi artefatti generati
- stato avanzamento (global + section)
  Tutto viene assemblato server-side in un “Context Pack” con dimensioni controllate:
- summary per storico lungo
- include raw solo per finestre recenti

### 6.2 Regola: niente segreti nel client

- API keys Gemini e provider (push/realtime/storage) solo su server (env).
- Il client riceve solo output e dati strettamente necessari.

## 7) Tooling & Mutations

- Le mutazioni avvengono solo via Tool API server-side (mai SQL generato dall’LLM).
- Ogni tool call produce:
  - AuditLog
  - ToolEvent visibile in chat
- Distruttivi:
  - confirmToken (2-step)
  - owner mode se ad alto impatto

## 8) Live (audio/video)

- WebRTC lato client
- Signaling via provider realtime scelto (no assunzioni WebSocket Vercel)
- In assenza di Live API vendor:
  - dettatura: Web Speech API (fallback)
  - video: snapshot periodici -> analisi asincrona

## 9) Notifiche

- In-app: DB + UI inbox + badge
- Web Push (opt-in):
  - service worker
  - VAPID
  - invio da cron
- SMS (opzionale):
  - provider (Twilio o equivalente)
  - nessuna SIM “fisica” necessaria: invio via API provider
  - contenuto non sensibile

## 10) Responsive & UI

- 100dvh e safe-area insets su mobile
- touch targets >= 44px
- lazy-load moduli pesanti (barcode, charts, webrtc)
- token semantici per colori/material/ombre
- “UI viva” guidata da mood/progress state (global + per sezione)

## 11) Share + PDF

- Share link pubblico read-only:
  - token sicuro
  - revoca/scadenza
  - pagina /share/[token]
- Export PDF server-side:
  - NutritionPlan, GroceryList, Recipe, WorkoutPlan
  - stampabile

## 12) Observability & Security

- zod su tutte le API
- rate limiting su chat/upload/tool/share/export
- sanitizzazione input (markdown safe)
- logging strutturato
- optional Sentry
