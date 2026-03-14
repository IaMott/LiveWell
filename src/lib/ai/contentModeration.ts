/**
 * Content Moderation Layer — LiveWell
 *
 * Analizza messaggi utente e risposte AI per rilevare contenuto problematico.
 * Progettato per essere zero-dependency (no external APIs) e latency-free in prod.
 *
 * Flag types:
 * - self_harm: indicatori di autolesionismo o suicidio
 * - medical_emergency: sintomi che richiedono 118 immediato
 * - violence: linguaggio violento diretto
 * - pii: possibile dati personali sensibili (CF, carte di credito)
 *
 * Azioni:
 * - 'none': nessuna azione
 * - 'warn': aggiungi disclaimer nella risposta
 * - 'block': blocca la risposta, restituisci messaggio di emergenza
 * - 'escalate': log ad alta priorità + warn
 */

import { prisma } from '@/lib/prisma'

export type FlagType = 'self_harm' | 'medical_emergency' | 'violence' | 'pii'
export type ModerationSeverity = 'low' | 'medium' | 'high'
export type ModerationAction = 'none' | 'warn' | 'block' | 'escalate'

export type ModerationResult = {
  action: ModerationAction
  flags: Array<{
    type: FlagType
    severity: ModerationSeverity
    matched: string
  }>
  emergencyMessage?: string
}

// ─────────────────────────────────────────
// Pattern rules (Italian-first, some English)
// ─────────────────────────────────────────

type Rule = {
  type: FlagType
  severity: ModerationSeverity
  patterns: RegExp[]
}

const RULES: Rule[] = [
  {
    type: 'self_harm',
    severity: 'high',
    patterns: [
      /\b(voglio|vorrei|penso di)\s+(morire|ammazzarmi|togliermi la vita|farla finita|suicidarmi)\b/i,
      /\b(non voglio|non riesco a)\s+(andare avanti|vivere|continuare)\b/i,
      /\b(mi taglio|mi faccio del male|mi sto facendo del male)\b/i,
      /\bsuicid[io]\b/i,
      /\bself.?harm\b/i,
      /\bkill myself\b/i,
    ],
  },
  {
    type: 'medical_emergency',
    severity: 'high',
    patterns: [
      /\b(dolore\s+al\s+petto|chest\s+pain)\b.*\b(forte|intenso|non passa|da ore)\b/i,
      /\b(non riesco a respirare|fatico a respirare|manca il respiro|dispnea grave)\b/i,
      /\b(sto perdendo conoscenza|mi gira la testa e\s+sto cadendo|sono svenuto)\b/i,
      /\b(ho\s+avuto\s+un\s+infarto|ictus|stroke|convulsion[ie])\b/i,
      /\b(sanguinamento\s+abbondante|perdita\s+di\s+sangue\s+importante)\b/i,
      /\b(reazione\s+allergica|anafilassi|shock\s+anafilattico)\b/i,
    ],
  },
  {
    type: 'medical_emergency',
    severity: 'medium',
    patterns: [
      /\b(dolore\s+al\s+petto)\b/i,
      /\b(difficoltà\s+respiratorie|respiro\s+corto)\b/i,
      /\b(pressione\s+molto\s+alta|200[/ ]\d+)\b/i,
    ],
  },
  {
    type: 'violence',
    severity: 'high',
    patterns: [
      /\b(voglio|devo)\s+(uccidere|ammazzare|fare del male a)\s+(qualcuno|una persona)\b/i,
      /\b(kill|hurt|attack)\s+(someone|people|them)\b/i,
    ],
  },
  {
    type: 'pii',
    severity: 'medium',
    patterns: [
      // Codice fiscale italiano
      /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/i,
      // Carta di credito (16 cifre con spazi o trattini)
      /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/,
      // IBAN italiano
      /\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/i,
    ],
  },
]

// ─────────────────────────────────────────
// Core moderation logic
// ─────────────────────────────────────────

export function moderateText(text: string): ModerationResult {
  const flags: ModerationResult['flags'] = []

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        flags.push({
          type: rule.type,
          severity: rule.severity,
          matched: rule.type, // never log the actual matched string for privacy
        })
        break // one match per rule is enough
      }
    }
  }

  if (flags.length === 0) return { action: 'none', flags: [] }

  const highSelfHarm = flags.some((f) => f.type === 'self_harm' && f.severity === 'high')
  const highMedical = flags.some((f) => f.type === 'medical_emergency' && f.severity === 'high')
  const highViolence = flags.some((f) => f.type === 'violence' && f.severity === 'high')
  const mediumMedical = flags.some((f) => f.type === 'medical_emergency' && f.severity === 'medium')
  const hasPii = flags.some((f) => f.type === 'pii')

  if (highSelfHarm) {
    return {
      action: 'block',
      flags,
      emergencyMessage:
        '🆘 Mi preoccupo per te. Se stai attraversando un momento molto difficile, ti chiedo di contattare il **Telefono Amico: 02 2327 2327** o il **Telefono Azzurro: 19696** (attivi 24h). Puoi anche chiamare il **118** in caso di emergenza immediata. Sono qui con te, ma questi professionisti possono aiutarti davvero in questo momento.',
    }
  }

  if (highViolence) {
    return {
      action: 'block',
      flags,
      emergencyMessage:
        'Non posso aiutarti con questo. Se stai vivendo una situazione di pericolo, chiama il **112** (emergenza) o il **1522** (violenza e stalking).',
    }
  }

  if (highMedical) {
    return {
      action: 'escalate',
      flags,
      emergencyMessage:
        '⚠️ I sintomi che descrivi potrebbero richiedere assistenza medica immediata. **Chiama il 118** o recati al pronto soccorso più vicino. Non aspettare — la tua salute è la priorità.',
    }
  }

  if (mediumMedical) {
    return {
      action: 'warn',
      flags,
    }
  }

  if (hasPii) {
    return {
      action: 'warn',
      flags,
    }
  }

  return { action: 'warn', flags }
}

// ─────────────────────────────────────────
// Persist moderation event (fire-and-forget)
// ─────────────────────────────────────────

export function persistModerationLog(params: {
  userId: string
  conversationId?: string
  requestId: string
  result: ModerationResult
  messageExcerpt?: string
}): void {
  if (params.result.flags.length === 0) return

  const { userId, conversationId, requestId, result, messageExcerpt } = params
  const topFlag = result.flags.reduce((a, b) => {
    const order = { high: 3, medium: 2, low: 1 }
    return order[a.severity] >= order[b.severity] ? a : b
  })

  // Fire-and-forget — never block the main request
  void prisma.moderationLog
    .create({
      data: {
        userId,
        conversationId: conversationId ?? null,
        requestId,
        flagType: topFlag.type,
        severity: topFlag.severity,
        excerpt: messageExcerpt ? messageExcerpt.slice(0, 100) : null,
        action: result.action,
      },
    })
    .catch((err: unknown) => {
      console.error('[contentModeration] Failed to persist moderation log:', err)
    })
}
