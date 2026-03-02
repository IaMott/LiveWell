# LiveWell

**Il tuo assistente personale guidato da un team di specialisti.**

LiveWell è una web app AI-first con un'unica schermata: la chat. Un Orchestrator Agent (Gemini Flash 2.5) coordina un team di sub-agenti specializzati caricati da `/TEAM` per guidare l'utente verso benessere fisico e mentale con un approccio team-led — come dal medico, mai prescrittivo.

---

## Come funziona

1. **Scrivi, parla o mostra** (testo, audio live, video live, upload file).
2. **L'Orchestrator legge il tuo profilo + storico** e coinvolge i sub-agenti giusti da `/TEAM`.
3. **Le risposte arrivano in streaming.**
4. **Piani e progressi vengono salvati nel profilo** tramite tool sicuri (con audit log e confirm step).

Il team guida sempre: raccoglie dati, fa domande mirate, propone percorsi motivati. L'utente conferma solo vincoli pratici (tempo, budget, allergie, preferenze).

---

## Stack tecnico

- **Framework**: Next.js 16 App Router + TypeScript strict
- **UI**: TailwindCSS + shadcn/ui + Radix + lucide-react
- **State**: TanStack Query + Zustand (solo UI state)
- **DB**: PostgreSQL (Neon/Supabase) + Prisma
- **Auth**: NextAuth v5 (Auth.js)
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime (signaling WebRTC)
- **AI**: Gemini Flash 2.5 (server proxy) + mock provider
- **Notifiche**: in-app (obbligatorie) + Web Push opt-in

---

## Struttura del progetto

```
/TEAM/           ← profili agenti (.md) caricati a runtime
/agenti/         ← ruoli operativi per il workflow dev
/src/            ← codice sorgente Next.js
/tests/          ← test Vitest
/bkp/            ← backup locale + ops log (AGENTS.md)
AGENTS.md        ← workflow operativo obbligatorio
```

---

## Setup locale

```bash
cp .env.example .env.local
# Compila le variabili richieste

npm install
npm run dev
```

Visita [http://localhost:3000](http://localhost:3000).

---

## Script

| Comando | Descrizione |
|---|---|
| `npm run dev` | Server dev con hot reload |
| `npm run build` | Build production + typecheck |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Test Vitest |

---

## Sezioni profilo

1. `/profile/personal` — Dati personali
2. `/profile/health` — Metriche salute
3. `/profile/nutrition` — Diario, piani, barcode, lista spesa, ricette
4. `/profile/training` — Schede, log, progressi, timer
5. `/profile/mindfulness` — Storico consigli, check-in emotivi
6. `/profile/goals` — Obiettivi guidati dal team
7. `/profile/history` — Audit trail
8. `/profile/settings` — Tema, colori, notifiche, privacy

---

## Sicurezza

- Tutte le azioni AI passano per Tool API server-side (RBAC + audit log + confirmToken).
- Nessun accesso diretto a DB/filesystem/env vars dal modello.
- Anti prompt-injection: file upload non attiva tool distruttivi.
- Rate limit + idempotency key per tool sensibili.

---

*Nota: LiveWell non sostituisce professionisti medici. Per emergenze o segnali di rischio, l'app esegue escalation al professionista appropriato.*
