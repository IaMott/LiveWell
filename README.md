# LiveWell

**Il tuo assistente benessere guidato da un team di specialisti AI.**

LiveWell e una web app AI-first con un'unica schermata: la chat. Un Orchestrator Agent (Gemini 2.5 Flash) coordina 14 sub-agenti specializzati per guidare l'utente verso benessere fisico e mentale con un approccio team-led.

**Live:** [https://livewell-ochre.vercel.app](https://livewell-ochre.vercel.app)

---

## Documento canonico

Per regole architetturali, handoff reale multi-agent e anti-regressione usa come riferimento:

- `docs/PROJECT_BIBLE.md`

---

## Funzionalita

- **Chat AI con streaming** — Risposte in tempo reale via SSE con routing automatico a 14 specialisti
- **Upload multimedia** — Immagini (JPEG/PNG/WebP/GIF), audio (WebM/MP4/OGG/WAV/MP3), barcode scanner
- **Trascrizione vocale** — Speech-to-text via Gemini multimodal
- **Profilo utente** — 8 sezioni (personale, salute, nutrizione, allenamento, mindfulness, obiettivi, storico, impostazioni)
- **Notifiche intelligenti** — Generazione automatica da risposte specialisti con pattern matching
- **Condivisione** — Export conversazioni come testo, link di condivisione con scadenza 30 giorni
- **Sicurezza** — Rate limiting, security headers, validazione input con Zod

---

## Stack tecnico

| Componente | Tecnologia |
|---|---|
| **Framework** | Next.js 16.1.6 App Router, TypeScript strict |
| **UI** | Tailwind CSS v4, shadcn/ui, Radix, lucide-react |
| **Database** | PostgreSQL (Neon) + Prisma 5 |
| **Auth** | NextAuth v5 (JWT, Credentials provider) |
| **AI** | Google Gemini 2.5 Flash (`@google/genai`) |
| **Deploy** | Vercel (auto-deploy da GitHub) |
| **Test** | Vitest + Testing Library |
| **Lint** | ESLint + Prettier + Husky pre-commit |

---

## Struttura del progetto

```
src/
  app/
    (app)/              # Route group principale (chat + profilo)
    (auth)/             # Login + Register
    api/
      auth/             # NextAuth + register + me
      chat/             # POST streaming SSE
      conversations/    # CRUD + export + share
      notifications/    # CRUD + read-all
      profile/          # GET/PUT profilo utente
      share/            # Viewer pubblico (no auth)
      transcribe/       # Speech-to-text Gemini
      upload/           # File upload (immagini + audio)
  components/
    auth/               # LoginForm, RegisterForm
    chat/               # ChatContainer, MessageList, MessageBubble, ChatInput, share/
    layout/             # AppShell, TopBar
    mood/               # MoodProvider, MoodGradient
    notifications/      # NotificationBell, NotificationCenter
    profile/            # ProfileNav, ProfileShell, ProfileForm, pages/
  hooks/
    useChat.ts          # Chat SSE + conversation management
    useNotifications.ts # Polling notifiche (30s)
    useProfile.ts       # Load/save profilo
  lib/
    ai/                 # Orchestrator, specialists, prompts, Gemini client
    auth.ts             # NextAuth config (Node.js)
    auth.config.ts      # Auth config (Edge/middleware)
    notifications.ts    # createNotification, shouldNotify
    prisma.ts           # Prisma singleton
    rate-limit.ts       # Rate limiter in-memory
    utils.ts            # cn() utility
TEAM/                   # 14 prompt files specialisti (.md)
prisma/
  schema.prisma         # 6 modelli: User, UserProfile, Conversation, Message, Attachment, Notification
```

---

## Setup locale

### Prerequisiti

- Node.js >= 18
- PostgreSQL (locale o Neon free tier)

### Installazione

```bash
git clone https://github.com/IaMott/LiveWell.git
cd LiveWell

# Copia e configura le variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local con i tuoi valori

# Installa dipendenze
npm install

# Crea le tabelle nel database
npx prisma db push

# Avvia il server di sviluppo
npm run dev
```

Visita [http://localhost:3000](http://localhost:3000).

---

## Variabili d'ambiente

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `DATABASE_URL` | Si | Connection string PostgreSQL |
| `NEXTAUTH_SECRET` | Si | Secret per JWT (min 32 caratteri) |
| `AUTH_TRUST_HOST` | Si | Impostare a `true` |
| `GEMINI_API_KEY` | Si | Chiave API da [Google AI Studio](https://aistudio.google.com/) |
| `AI_PROVIDER` | No | `gemini` (default) o `mock` per sviluppo senza API key |
| `AI_MODEL` | No | Modello Gemini (default: `gemini-2.5-flash`) |
| `NEXT_PUBLIC_APP_URL` | No | URL base app (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_NAME` | No | Nome app (default: `LiveWell`) |

> **Nota:** Se `GEMINI_API_KEY` non e impostata, l'app usa automaticamente un mock provider che simula le risposte AI.

---

## Script

| Comando | Descrizione |
|---|---|
| `npm run dev` | Server dev con hot reload (Turbopack) |
| `npm run build` | Build production (prisma generate + next build) |
| `npm run start` | Avvia server production |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Test Vitest |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sincronizza schema Prisma con DB |
| `npm run db:migrate` | Crea migration Prisma |

---

## API Reference

### Autenticazione

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/auth/register` | Registrazione (email, password, name) |
| GET | `/api/auth/me` | Dati utente autenticato |
| * | `/api/auth/[...nextauth]` | NextAuth endpoints (login, session, csrf) |

### Chat

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/chat` | Invia messaggio, ricevi risposta SSE streaming |

**SSE Events:** `meta`, `routing`, `agent_turn`, `agent_delta`, `agent_done`, `delta`, `done`

### Conversazioni

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/conversations` | Lista conversazioni con anteprima |
| GET | `/api/conversations/[id]` | Dettaglio con messaggi |
| GET | `/api/conversations/[id]/export` | Download testo (.txt) |
| POST | `/api/conversations/[id]/share` | Crea link condivisibile |
| DELETE | `/api/conversations/[id]/share` | Revoca condivisione |

### Condivisione pubblica

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/share/[token]` | Dati conversazione (no auth, scade dopo 30 giorni) |

### File

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/upload` | Upload file (max 10 MB) |
| POST | `/api/transcribe` | Trascrizione audio (Gemini) |

### Profilo

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/profile` | Profilo utente completo |
| PUT | `/api/profile` | Aggiorna sezione profilo |

### Notifiche

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/notifications` | Lista (opzionale `?unread=true`) |
| PATCH | `/api/notifications/[id]` | Segna come letta |
| DELETE | `/api/notifications/[id]` | Elimina |
| POST | `/api/notifications/read-all` | Segna tutte come lette |

---

## Rate Limiting

| Endpoint | Limite | Per |
|---|---|---|
| `/api/chat` | 30/min | utente |
| `/api/upload` | 15/min | utente |
| `/api/auth/register` | 5/min | IP |
| `/api/share/[token]` | 60/min | IP |
| `/api/conversations/[id]/share` | 10/min | utente |
| `/api/profile` PUT | 20/min | utente |

---

## Architettura AI

```
Messaggio utente
    |
    v
[Risk Triage] ── R2/R3 → Risposta di sicurezza immediata
    |
    R0/R1
    v
[Interview Machine] ── Raccoglie MVD (Minimum Viable Data)
    |
    v
[Keyword Router] → Seleziona specialista da 14 disponibili
    |
    v
[Context Builder] → Estrae eta, peso, altezza, obiettivi dalla cronologia
    |
    v
[Gemini 2.5 Flash] → System prompt da TEAM/<specialista>.md
    |
    v
[SSE Stream] → Delta chunks al client
    |
    v
[Notification Check] → Pattern matching su contenuto actionable
```

### Specialisti disponibili (TEAM/)

Nutrizione, Allenamento, Mindfulness, Sonno, Motivazione, Postura, Integratori, Ricette, Obiettivi, Check-in, Prevenzione, Primo Soccorso Emotivo, Educazione Sanitaria, Generalista.

---

## Security Headers

Configurati in `next.config.ts`, attivi su tutte le rotte:

- `Strict-Transport-Security` (HSTS con preload)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`

---

## Deploy

Il progetto e deployato su **Vercel** con auto-deploy da GitHub:

1. Ogni push a `main` triggera un build + deploy automatico
2. Il database Neon Postgres (Frankfurt) e collegato tramite `DATABASE_URL`
3. Le variabili d'ambiente sono configurate nel Vercel Dashboard

### Deploy manuale

```bash
# Installa Vercel CLI
npm i -g vercel

# Login + link progetto
vercel login
vercel link

# Deploy
vercel --prod
```

---

## Database

### Modelli Prisma

- **User** — email, passwordHash, name
- **UserProfile** — birthDate, gender, height, weight + sezioni JSON (health, nutrition, training, mindfulness, goals, settings)
- **Conversation** — title, userId, shareToken, sharedAt
- **Message** — role, content, conversationId
- **Attachment** — type, fileName, fileSize, mimeType, url, metadata
- **Notification** — type, title, message, metadata, read, readAt

### Migrazioni

```bash
# Sviluppo: sincronizza schema con DB (reset se necessario)
npx prisma db push

# Produzione: crea migration
npx prisma migrate dev --name descrizione
```

---

## Disclaimer

LiveWell **non sostituisce professionisti medici**. Per emergenze o segnali di rischio, l'app esegue escalation al professionista appropriato. I consigli forniti sono di carattere informativo e non costituiscono diagnosi o prescrizioni mediche.

---

*Built with Next.js, Gemini AI, and Vercel.*
