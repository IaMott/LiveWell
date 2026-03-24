/**
 * Contextual quick reply generator.
 *
 * When the assistant asks a domain-specific question, we detect the question
 * type via keyword patterns and return a set of short, tappable answer options.
 * This avoids asking users to describe technical/medical concepts in free text.
 *
 * No LLM call — pure pattern matching against the last assistant message.
 */

import type { QuickReply } from '../types'

let _counter = 0
function cqr(label: string, text: string, emoji?: string): QuickReply {
  return { id: `cqr-${++_counter}`, label, text, emoji }
}

// ── Pattern catalogue ────────────────────────────────────────────────────────

type PatternRule = {
  patterns: RegExp[]
  replies: QuickReply[]
}

const RULES: PatternRule[] = [
  // ── Anatomical location ────────────────────────────────────────────────────
  {
    patterns: [
      /indica.*?punt[oi]/i,
      /localizza.*?dolor[ei]/i,
      /dove.*?sent[io].*?dolor[ei]/i,
      /dove.*?fa.*?male/i,
      /precis.*?dov[eè]/i,
      /punto.*?esatt/i,
      /area.*?interest/i,
      /parte.*?del corpo/i,
      /zona.*?dolor/i,
    ],
    replies: [
      cqr('Collo', 'Il dolore è al collo', '🔴'),
      cqr('Trapezio', 'Sento dolore/tensione al trapezio', '🔴'),
      cqr('Spalla sin.', 'Alla spalla sinistra', '🔴'),
      cqr('Spalla dx', 'Alla spalla destra', '🔴'),
      cqr('Braccio', 'Si irradia lungo il braccio', '🔴'),
      cqr('Più zone', 'In più punti contemporaneamente', '🔴'),
    ],
  },

  // ── Pain intensity scale ───────────────────────────────────────────────────
  {
    patterns: [
      /scala.*?1.*?10/i,
      /quanto.*?intenso/i,
      /quanto.*?dolor[ei]/i,
      /intensità.*?dolor[ei]/i,
      /valut.*?dolor[ei]/i,
      /dolor[ei].*?fort[ei]/i,
    ],
    replies: [
      cqr('1-3 Lieve', 'Dolore lieve (1-3 su 10)', '🟢'),
      cqr('4-6 Moderato', 'Dolore moderato (4-6 su 10)', '🟡'),
      cqr('7-8 Forte', 'Dolore forte (7-8 su 10)', '🟠'),
      cqr('9-10 Molto forte', 'Dolore molto forte (9-10 su 10)', '🔴'),
    ],
  },

  // ── Frequency / how often ──────────────────────────────────────────────────
  {
    patterns: [
      /quante.*?volt[ei]/i,
      /quanti.*?giorni/i,
      /quante.*?volte.*?settimana/i,
      /frequenz[ai]/i,
      /ogni quanto/i,
      /con che.*?regolar/i,
    ],
    replies: [
      cqr('Quasi mai', 'Raramente, meno di 1 volta a settimana', '📅'),
      cqr('1-2 volte/sett.', '1-2 volte a settimana', '📅'),
      cqr('3-4 volte/sett.', '3-4 volte a settimana', '📅'),
      cqr('Quasi ogni giorno', 'Quasi tutti i giorni', '📅'),
      cqr('Ogni giorno', 'Ogni giorno', '📅'),
    ],
  },

  // ── Duration of symptom ───────────────────────────────────────────────────
  {
    patterns: [
      /da quanto.*?tempo/i,
      /da quando.*?sent[io]/i,
      /quanto.*?dura/i,
      /durata.*?sintom/i,
      /inizi[ao].*?quando/i,
    ],
    replies: [
      cqr('Pochi giorni', 'È iniziato pochi giorni fa', '🕐'),
      cqr('1-2 settimane', 'Da 1-2 settimane', '🕐'),
      cqr('1 mese', 'Da circa un mese', '🕐'),
      cqr('Più mesi', 'Da diversi mesi', '🕐'),
      cqr('Cronico', 'È un problema ricorrente da anni', '🕐'),
    ],
  },

  // ── Sleep quality ─────────────────────────────────────────────────────────
  {
    patterns: [
      /com'è.*?il.*?sono/i,
      /come.*?dormi/i,
      /qualità.*?del.*?sono/i,
      /ore.*?di.*?sono/i,
      /quante.*?ore.*?dormi/i,
    ],
    replies: [
      cqr('Bene', 'Dormo bene, mi sveglio riposato', '😴'),
      cqr('Discreto', 'Abbastanza bene, qualche risveglio', '😴'),
      cqr('Male', 'Dormo male, mi sveglio stanco', '😴'),
      cqr('< 6 ore', 'Meno di 6 ore a notte', '⏰'),
      cqr('6-7 ore', 'Circa 6-7 ore a notte', '⏰'),
      cqr('8+ ore', '8 ore o più a notte', '⏰'),
    ],
  },

  // ── Training frequency / availability ─────────────────────────────────────
  {
    patterns: [
      /quante.*?sedut[ei]/i,
      /quanti.*?allenament/i,
      /quante.*?volt[ei].*?palestra/i,
      /disponibil.*?allenament/i,
      /realistically.*?fare/i,
    ],
    replies: [
      cqr('1 volta/sett.', '1 volta a settimana', '🏋️'),
      cqr('2 volte/sett.', '2 volte a settimana', '🏋️'),
      cqr('3 volte/sett.', '3 volte a settimana', '🏋️'),
      cqr('4+ volte/sett.', '4 o più volte a settimana', '🏋️'),
    ],
  },

  // ── Yes / No / Maybe quick closes ─────────────────────────────────────────
  {
    patterns: [
      /hai già.*?diagnos/i,
      /hai già.*?esam/i,
      /hai.*?refert/i,
      /hai fatto.*?visita/i,
      /sei stato.*?dal medico/i,
    ],
    replies: [
      cqr('Sì, ho una diagnosi', 'Sì, ho già una diagnosi medica', '✅'),
      cqr('Sì, ho esami', 'Sì, ho esami recenti (li condivido)', '📄'),
      cqr('No, non ancora', 'No, non ho ancora consultato un medico', '❌'),
    ],
  },

  // ── Medication / supplements ──────────────────────────────────────────────
  {
    patterns: [
      /stai.*?assumendo/i,
      /prendi.*?farmac/i,
      /prendi.*?integrat/i,
      /stai.*?prendendo/i,
      /quale.*?prodott/i,
      /nome.*?del.*?farmac/i,
      /nome.*?del.*?integrat/i,
    ],
    replies: [
      cqr('Nessuno', 'Non prendo farmaci o integratori', '💊'),
      cqr('Solo integratori', 'Prendo solo integratori (te lo dico)', '💊'),
      cqr('Farmaci prescritti', 'Prendo farmaci su prescrizione medica', '💊'),
      cqr('Antidolorifico', 'Ho preso un antidolorifico/antinfiammatorio', '💊'),
    ],
  },
]

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Given the last assistant response, detect if it ends with a question and
 * return contextual quick reply options. Returns [] if no pattern matches.
 */
export function buildContextualQuickReplies(assistantMessage: string): QuickReply[] {
  // Only trigger when the message contains a question mark
  if (!assistantMessage.includes('?')) return []

  // Extract the last ~300 chars (where the question typically lives)
  const tail = assistantMessage.slice(-300).toLowerCase()

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(tail)) {
        return rule.replies
      }
    }
  }

  return []
}
