# PRD — LiveWell (Web App “Chat-First”, Team-Led)

## 1) Visione

LiveWell è una web app “chat-first” in cui **l’utente interagisce solo tramite la chat con un team di agenti** (professionisti + orchestratore).  
Il resto dell’app (Profilo, Grafici, Tabelle, Storico) **non è un luogo dove “fare”**, ma un luogo dove **vedere, verificare, condividere e stampare** ciò che è stato deciso/compilato tramite chat.

## 2) Principio chiave: Team-Led (come dal medico)

- L’utente **non comanda** il team (“fammi dieta X”, “dammi scheda Y”).
- Il team:
  1. raccoglie dati e contesto,
  2. fa domande mirate se manca informazione (gating),
  3. propone un percorso sostenibile e motivato,
  4. chiede conferma **solo** su vincoli pratici e preferenze non cliniche (orari, gusti, attrezzatura, budget),
  5. applica guardrail e escalation se rischi (fisici/psicologici).
- Se l’utente prova a imporre scelte non sostenibili:
  - il team spiega perché,
  - propone alternative,
  - chiede conferma solo sui vincoli pratici.

## 3) Piattaforme supportate

- Web responsive (desktop, tablet, smartphone).
- UI “nativa-like”: touch-friendly, safe areas, 100dvh, comportamento tastiera mobile stabile.
- (Opzionale) PWA per installazione e Web Push (necessaria per push su web).

## 4) UX: Schermata Chat (stile ChatGPT-like)

### 4.1 Layout (vincolante)

- Schermata intera:
  - area messaggi scrollabile
  - **composer** ancorato in basso (in asse verticale)
- In alto:
  - solo **avatar profilo in alto a destra** (tap/click -> /profile)
- Nessun “cerchio parlante” stile voice orb.
- Feedback voce agente: **effetto pulsante** (glow/opacity) legato all’ampiezza del parlato, usando colore definito in impostazioni.

### 4.2 Composer (controlli)

- Campo testo
- Pulsante “plus”:
  - allegazione file
  - scansione barcode e QR (da fotocamera)
- Pulsante microfono:
  - dettatura testo (speech-to-text)
- Pulsante live:
  - avvio live audio/video (modalità conversazione live)
- Pulsante invio

### 4.3 Icone “accese per ambito”

- Le icone sono **nere di default**.
- Quando il sistema interpreta l’ambito del discorso, **accende l’icona** (solo stroke/linee SVG) in **verde**:
  - nutrizione/ricette/spesa -> food
  - salute fisica -> health
  - allenamento -> gym
  - mindfulness -> mental
  - ispirazione -> idea
  - storico -> cronology
  - settings -> setting
- L’accensione è guidata dal router semantico (orchestratore) e deve essere coerente con tool/actions/risposta.

## 5) UI Viva (colori + animazioni “emotive”)

### 5.1 Stato globale + stato per sezione

- Esiste un **Global Progress State** (riassume: nutrizione, allenamento, salute fisica, mindfulness, ispirazione).
- Ogni sezione del profilo ha il proprio **Section Progress State**.
- UI usa token semantici per mappare progress state -> variazioni:
  - background/surface tint
  - grafici
  - badge
  - micro-animazioni (transizioni morbide, non “circus”)
- Regola: il colore comunica **stato** e **andamento**, non decorazione.

### 5.2 Motion & Accessibilità

- Animazioni sobrie, fisiche (easing morbido).
- Rispetto `prefers-reduced-motion`: riduci/azzera blur animati, scale, transizioni lunghe.

## 6) Profilo: rendicontazione + storico (non “operativo”)

Il profilo è una sezione a pagine/sottopagine con:

- dati strutturati
- tabelle
- grafici di andamento (sempre presenti per ogni area)
- storico output del team
- impostazioni (tema, notifiche, privacy, owner mode)

### 6.1 Sezioni profilo (minime)

- /profile/personal
- /profile/health
- /profile/nutrition (tabs: piani, diario, database alimenti, barcode, lista spesa, ricette)
- /profile/training (tabs: schede, log, progressi + timer recupero/esercizi a tempo)
- /profile/mindfulness (diario mentale/confessioni/richieste + consigli + grafici andamento)
- /profile/inspiration (idee personali o professionali + storico + tagging + grafici andamento “attività/ritmo”)
- /profile/goals (obiettivi guidati dal team + milestone)
- /profile/history (audit trail degli artefatti generati)
- /profile/settings (tema, notifiche, privacy/export, owner mode)

### 6.2 Condivisione e PDF

Risorse condivisibili (read-only link + PDF):

- piani alimentari
- lista spesa
- ricette
- piani allenamento
  Regole privacy:
- niente dati medici o mindfulness nei link pubblici per default
- token non indovinabile, revocabile, scadenza opzionale

## 7) Notifiche (non “per ogni cosa”)

Notifiche = solo quando un professionista invia:

- reminder
- comunicazione di supporto
- “daily brief” (se attivo)
  Canali:
- In-app (obbligatorio)
- Web Push opt-in (consigliato)
- SMS opzionale via provider (feature flag), contenuto non sensibile

## 8) AI: orchestratore + team agent (veri agenti)

- Orchestratore = agente coordinatore.
- Team = lista agenti “pensanti” caricati da /TEAM (non hardcoded).
- Consensus loop: il team produce proposte -> orchestratore risolve conflitti -> risposta unica.

## 9) Auto-update “ultimo Gemini”

- Il sistema non deve essere legato a una versione statica.
- Deve esistere una strategia “LatestModelResolver”:
  - sceglie automaticamente l’ultimo modello disponibile (free/pro)
  - se utente ha abbonamento, usa pro
  - fallback controllato se il latest non è disponibile

## 10) Sicurezza, salute, guardrail

- Niente diagnosi/prescrizioni.
- Disclaimer chiaro.
- Escalation per segnali gravi: invito a professionista reale/emergenza.
- Anti prompt-injection per tool: conferma esplicita per azioni distruttive, allowlist, RBAC, audit.

## 11) Success metrics (MVP)

- Utente può usare l’app “solo chat” e vedere tutto rendicontato nel profilo.
- Piani/ricette/schede vengono creati dal team e salvati senza compilazioni manuali.
- Notifiche arrivano (in-app + push se opt-in).
- Share link + PDF funzionano.
- UI responsive e stabile su mobile/tablet/desktop.
