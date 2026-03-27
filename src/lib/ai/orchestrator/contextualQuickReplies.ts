/**
 * Contextual quick reply generator.
 *
 * When the assistant asks a domain-specific question, we detect the question
 * type via keyword patterns and return a set of short, tappable answer options.
 * This avoids asking users to describe technical/medical concepts in free text.
 *
 * No LLM call — pure pattern matching against the last assistant message.
 *
 * Architecture note: RULES stores only static templates (label, text, emoji).
 * IDs are generated with crypto.randomUUID() at call time inside
 * buildContextualQuickReplies(), so each request gets fresh unique IDs even
 * on warm serverless invocations where the module is cached.
 */

import type { QuickReply } from '../types'

type ReplyTemplate = { label: string; text: string; emoji?: string }

type PatternRule = {
  patterns: RegExp[]
  templates: ReplyTemplate[]
}

function normalizeMessage(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
}

function extractLastQuestion(assistantMessage: string): string | null {
  const normalized = normalizeMessage(assistantMessage)
  if (!normalized.includes('?')) return null

  const questionChunks = normalized.match(/[^?]+\?/g)
  if (!questionChunks || questionChunks.length === 0) return null

  const lastQuestion = normalizeMessage(questionChunks[questionChunks.length - 1] ?? '')
  return lastQuestion.length > 0 ? lastQuestion : null
}

const QUESTION_DIMENSIONS: Array<{ key: string; pattern: RegExp }> = [
  { key: 'frequency', pattern: /\b(quante?\s+volte|frequenza)\b/i },
  { key: 'time', pattern: /\b(quando|orari?|a che ora|in che momento)\b/i },
  { key: 'duration', pattern: /\b(quanto tempo|durata)\b/i },
  { key: 'location', pattern: /\b(dove|in quale zona|in quale punto)\b/i },
  { key: 'severity', pattern: /\b(intensit[aà]|scala|quanto.*?(intenso|forte))\b/i },
  { key: 'modality', pattern: /\b(come|in che modo|che tipo)\b/i },
]

function isCompoundQuestion(question: string): boolean {
  const matchedDimensions = QUESTION_DIMENSIONS.filter(({ pattern }) => pattern.test(question)).map(
    ({ key }) => key,
  )
  if (new Set(matchedDimensions).size >= 2) return true

  const conjunctionCount = (question.match(/\b(e|oppure|o)\b/gi) ?? []).length
  if (question.length > 180 || conjunctionCount >= 3) return true

  return false
}

function dedupeTemplates(templates: ReplyTemplate[]): ReplyTemplate[] {
  const out: ReplyTemplate[] = []
  const seen = new Set<string>()

  for (const template of templates) {
    const key = `${template.label.trim().toLowerCase()}::${template.text.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(template)
  }

  return out
}

// ── Pattern catalogue ────────────────────────────────────────────────────────

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
    templates: [
      { label: 'Collo', text: 'Il dolore è al collo', emoji: '🔴' },
      { label: 'Trapezio', text: 'Sento dolore/tensione al trapezio', emoji: '🔴' },
      { label: 'Spalla sin.', text: 'Alla spalla sinistra', emoji: '🔴' },
      { label: 'Spalla dx', text: 'Alla spalla destra', emoji: '🔴' },
      { label: 'Braccio', text: 'Si irradia lungo il braccio', emoji: '🔴' },
      { label: 'Più zone', text: 'In più punti contemporaneamente', emoji: '🔴' },
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
    templates: [
      { label: '1-3 Lieve', text: 'Dolore lieve (1-3 su 10)', emoji: '🟢' },
      { label: '4-6 Moderato', text: 'Dolore moderato (4-6 su 10)', emoji: '🟡' },
      { label: '7-8 Forte', text: 'Dolore forte (7-8 su 10)', emoji: '🟠' },
      { label: '9-10 Molto forte', text: 'Dolore molto forte (9-10 su 10)', emoji: '🔴' },
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
    templates: [
      { label: 'Quasi mai', text: 'Raramente, meno di 1 volta a settimana', emoji: '📅' },
      { label: '1-2 volte/sett.', text: '1-2 volte a settimana', emoji: '📅' },
      { label: '3-4 volte/sett.', text: '3-4 volte a settimana', emoji: '📅' },
      { label: 'Quasi ogni giorno', text: 'Quasi tutti i giorni', emoji: '📅' },
      { label: 'Ogni giorno', text: 'Ogni giorno', emoji: '📅' },
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
    templates: [
      { label: 'Pochi giorni', text: 'È iniziato pochi giorni fa', emoji: '🕐' },
      { label: '1-2 settimane', text: 'Da 1-2 settimane', emoji: '🕐' },
      { label: '1 mese', text: 'Da circa un mese', emoji: '🕐' },
      { label: 'Più mesi', text: 'Da diversi mesi', emoji: '🕐' },
      { label: 'Cronico', text: 'È un problema ricorrente da anni', emoji: '🕐' },
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
    templates: [
      { label: 'Bene', text: 'Dormo bene, mi sveglio riposato', emoji: '😴' },
      { label: 'Discreto', text: 'Abbastanza bene, qualche risveglio', emoji: '😴' },
      { label: 'Male', text: 'Dormo male, mi sveglio stanco', emoji: '😴' },
      { label: '< 6 ore', text: 'Meno di 6 ore a notte', emoji: '⏰' },
      { label: '6-7 ore', text: 'Circa 6-7 ore a notte', emoji: '⏰' },
      { label: '8+ ore', text: '8 ore o più a notte', emoji: '⏰' },
    ],
  },

  // ── Training frequency / availability ─────────────────────────────────────
  {
    patterns: [
      /quante.*?sedut[ei]/i,
      /quanti.*?allenament/i,
      /quante.*?volt[ei].*?palestra/i,
      /disponibil.*?allenament/i,
      /realisticamente.*?fare/i,
      /realist.*?allenament/i,
    ],
    templates: [
      { label: '1 volta/sett.', text: '1 volta a settimana', emoji: '🏋️' },
      { label: '2 volte/sett.', text: '2 volte a settimana', emoji: '🏋️' },
      { label: '3 volte/sett.', text: '3 volte a settimana', emoji: '🏋️' },
      { label: '4+ volte/sett.', text: '4 o più volte a settimana', emoji: '🏋️' },
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
    templates: [
      { label: 'Sì, ho una diagnosi', text: 'Sì, ho già una diagnosi medica', emoji: '✅' },
      { label: 'Sì, ho esami', text: 'Sì, ho esami recenti (li condivido)', emoji: '📄' },
      { label: 'No, non ancora', text: 'No, non ho ancora consultato un medico', emoji: '❌' },
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
    templates: [
      { label: 'Nessuno', text: 'Non prendo farmaci o integratori', emoji: '💊' },
      { label: 'Solo integratori', text: 'Prendo solo integratori (te lo dico)', emoji: '💊' },
      { label: 'Farmaci prescritti', text: 'Prendo farmaci su prescrizione medica', emoji: '💊' },
      {
        label: 'Antidolorifico',
        text: 'Ho preso un antidolorifico/antinfiammatorio',
        emoji: '💊',
      },
    ],
  },

  // ── Menstrual cycle regularity (Ginecologo) ───────────────────────────────
  {
    patterns: [
      /ciclo.*?regolar/i,
      /mestruazion.*?regolar/i,
      /come.*?è.*?il.*?ciclo/i,
      /ciclo.*?mestrual/i,
      /hai.*?ciclo.*?regolare/i,
    ],
    templates: [
      { label: 'Regolare', text: 'Il ciclo è regolare (ogni 28-30 giorni circa)', emoji: '🌸' },
      { label: 'Irregolare', text: 'Il ciclo è irregolare', emoji: '🌸' },
      { label: 'Molto doloroso', text: 'Il ciclo è molto doloroso (dismenorrea)', emoji: '🌸' },
      { label: 'Abbondante', text: 'Il ciclo è abbondante', emoji: '🌸' },
      { label: 'Assente', text: 'Il ciclo è assente (amenorrea)', emoji: '🌸' },
    ],
  },

  // ── Blood glucose / glycemia (Diabetologo) ────────────────────────────────
  {
    patterns: [
      /glicemia.*?a.*?digiun/i,
      /ultimo.*?valor.*?glicemi/i,
      /conosci.*?glicemi/i,
      /glicemia.*?recent/i,
      /hba1c/i,
      /emoglobina.*?glicata/i,
    ],
    templates: [
      { label: '< 100 mg/dL', text: 'Glicemia a digiuno < 100 mg/dL (normale)', emoji: '🩸' },
      {
        label: '100-125 mg/dL',
        text: 'Glicemia a digiuno 100-125 mg/dL (pre-diabete)',
        emoji: '🩸',
      },
      {
        label: '> 126 mg/dL',
        text: 'Glicemia a digiuno > 126 mg/dL (diabete)',
        emoji: '🩸',
      },
      { label: 'Non so', text: 'Non conosco il mio valore di glicemia', emoji: '🩸' },
    ],
  },

  // ── Allergy reaction type (Allergologo) ───────────────────────────────────
  {
    patterns: [
      /come.*?si.*?manifest/i,
      /tipo.*?di.*?reazion/i,
      /reazion.*?allergic/i,
      /sintomi.*?allergi/i,
      /cosa.*?senti.*?quando/i,
    ],
    templates: [
      { label: 'Prurito / orticaria', text: 'Prurito, orticaria o rossore cutaneo', emoji: '🤧' },
      { label: 'Naso / occhi', text: 'Naso che cola, starnuti, occhi rossi', emoji: '🤧' },
      {
        label: 'Difficoltà respiratoria',
        text: 'Difficoltà respiratoria o respiro sibilante',
        emoji: '🤧',
      },
      { label: 'Gonfiore', text: 'Gonfiore a labbra, lingua o viso (angioedema)', emoji: '🤧' },
      {
        label: 'Shock anafilattico',
        text: 'Reazione grave con perdita di coscienza (anafilassi)',
        emoji: '🚨',
      },
    ],
  },

  // ── Functional autonomy (Geriatra) ────────────────────────────────────────
  {
    patterns: [
      /riesci.*?autonomamente/i,
      /autonomia.*?quotidiana/i,
      /attività.*?quotidiane/i,
      /riesci.*?svolgere/i,
      /capacità.*?funzional/i,
    ],
    templates: [
      {
        label: 'Completamente autonomo',
        text: 'Sono completamente autonomo nelle attività quotidiane',
        emoji: '🧓',
      },
      {
        label: 'Parzialmente autonomo',
        text: 'Ho bisogno di aiuto per alcune attività',
        emoji: '🧓',
      },
      { label: 'Dipendente', text: 'Ho bisogno di assistenza continua', emoji: '🧓' },
      { label: 'Caregiver presente', text: 'Ho un caregiver che mi assiste', emoji: '🧓' },
    ],
  },

  // ── Oncology treatment phase ───────────────────────────────────────────────
  {
    patterns: [
      /fase.*?del.*?percorso/i,
      /trattamento.*?attivo/i,
      /stai.*?seguendo.*?terapia/i,
      /chemioterapia.*?radioterapia/i,
      /in.*?cura.*?per/i,
    ],
    templates: [
      {
        label: 'In trattamento',
        text: 'Sono in trattamento attivo (chemio, radio, immunoterapia)',
        emoji: '🎗️',
      },
      { label: 'Mantenimento', text: 'Sono in fase di mantenimento o ormonoterapia', emoji: '🎗️' },
      { label: 'Follow-up', text: 'Sono in follow-up oncologico', emoji: '🎗️' },
      { label: 'Guarigione', text: 'Sono in remissione / guarito', emoji: '🎗️' },
      { label: 'Cure palliative', text: 'Sto seguendo cure palliative', emoji: '🎗️' },
    ],
  },
]

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Given the last assistant response, detect if it ends with a question and
 * return contextual quick reply options. Returns [] if no pattern matches.
 *
 * IDs are generated fresh per call — never reused across requests.
 */
export function buildContextualQuickReplies(assistantMessage: string): QuickReply[] {
  const lastQuestion = extractLastQuestion(assistantMessage)
  if (!lastQuestion) return []
  if (isCompoundQuestion(lastQuestion)) return []

  const tail = lastQuestion.toLowerCase()

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(tail)) {
        const templates = dedupeTemplates(rule.templates)
        if (templates.length < 2) return []

        return templates.map((t) => ({
          id: crypto.randomUUID(),
          label: t.label,
          text: t.text,
          emoji: t.emoji,
        }))
      }
    }
  }

  return []
}
