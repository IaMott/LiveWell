# Journal

Timestamp: 2026-03-11 14:59
Ruolo: frontend-developer
Prompt (riassunto): aggiungere solo il pulsante export DB dinamico in overview, senza altri cambi UI/layout.

Risultato (riassunto)
- Aggiunto pulsante "Export DB dinamico" nella card overview.
- Il pulsante richiama GET /api/profile/dynamic-db e scarica un JSON locale.
- Nessuna altra sezione/layout alterata.

Evidenze
- src/components/profile/sections/OverviewSection.tsx
- lint pass: npx eslint src/components/profile/sections/OverviewSection.tsx

Decisioni
- Modifica minimale: solo un nuovo bottone vicino a "Modifica".

Next
- Attesa tua conferma per eventuale commit/push/deploy.
