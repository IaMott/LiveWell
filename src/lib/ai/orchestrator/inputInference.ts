import { ActiveSpecialist, ContextPack, Domain, ToolCall } from '../types'

export type InferenceContext = {
  domainHint: Domain
  activeSpecialist?: ActiveSpecialist
}

export type PersonalSnapshot = {
  name?: string
  birthDate?: string
  gender?: string
  height?: number
  weight?: number
}

export function normalizeDateToIsoDate(d: Date): string {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDobFromNaturalMessage(message: string): string | null {
  const text = message.toLowerCase().trim()
  const now = new Date()
  const currentYear = now.getUTCFullYear()

  const ensureValid = (day: number, month: number, year: number): string | null => {
    if (year < 1900 || year > currentYear) return null
    if (month < 1 || month > 12) return null
    if (day < 1 || day > 31) return null
    const d = new Date(Date.UTC(year, month - 1, day))
    if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
      return null
    }
    return normalizeDateToIsoDate(d)
  }

  const numeric = text.match(/\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{4})\b/)
  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])
    const year = Number(numeric[3])
    const parsed = ensureValid(day, month, year)
    if (parsed) return parsed
  }

  const monthMap: Record<string, number> = {
    gennaio: 1,
    gen: 1,
    febbraio: 2,
    feb: 2,
    marzo: 3,
    mar: 3,
    aprile: 4,
    apr: 4,
    maggio: 5,
    mag: 5,
    giugno: 6,
    giu: 6,
    luglio: 7,
    lug: 7,
    agosto: 8,
    ago: 8,
    settembre: 9,
    set: 9,
    ottobre: 10,
    ott: 10,
    novembre: 11,
    nov: 11,
    dicembre: 12,
    dic: 12,
  }
  const words = text.match(
    /\b([0-3]?\d)\s+(gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|set|ottobre|ott|novembre|nov|dicembre|dic)\s+(\d{4})\b/,
  )
  if (words) {
    const day = Number(words[1])
    const month = monthMap[words[2]]
    const year = Number(words[3])
    const parsed = ensureValid(day, month, year)
    if (parsed) return parsed
  }

  return null
}

export function ageFromIsoDate(isoDate: string): number | null {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 ? age : null
}

export function isAgeQuestion(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('quanti anni') ||
    lower.includes('quanti anni ho') ||
    /\betà\b/.test(lower) ||
    /\beta\b/.test(lower)
  )
}

export function readPersonalSnapshot(contextPack: ContextPack): PersonalSnapshot {
  const profile = (contextPack.user.profile ?? {}) as Record<string, unknown>
  const attrs = contextPack.user.attributes ?? {}
  const personal = (attrs.personal ?? {}) as Record<string, { value?: unknown }>
  // health domain fallback — older entries were saved there before the fix
  const health = (attrs.health ?? {}) as Record<string, { value?: unknown }>

  const out: PersonalSnapshot = {}

  // Name — from account (injected by contextPackBuilder) or stored attribute
  const nameFromProfile = profile.name
  if (typeof nameFromProfile === 'string' && nameFromProfile) out.name = nameFromProfile
  const nameFromAttr = personal.name?.value
  if (!out.name && typeof nameFromAttr === 'string' && nameFromAttr) out.name = nameFromAttr

  const birthFromProfile = profile.birthDate
  if (typeof birthFromProfile === 'string' && birthFromProfile) out.birthDate = birthFromProfile
  const birthFromAttr = personal.birthDate?.value
  if (typeof birthFromAttr === 'string' && birthFromAttr) out.birthDate = birthFromAttr

  // Derive birthDate from stored age attribute when no explicit date is known
  if (!out.birthDate) {
    const ageFromAttr = personal.age?.value
    if (typeof ageFromAttr === 'number' && ageFromAttr >= 10 && ageFromAttr <= 110) {
      const birthYear = new Date().getFullYear() - Math.round(ageFromAttr)
      out.birthDate = `${birthYear}-01-01`
    }
  }

  const genderFromProfile = profile.gender
  if (typeof genderFromProfile === 'string' && genderFromProfile) out.gender = genderFromProfile
  const genderFromAttr = personal.gender?.value
  if (typeof genderFromAttr === 'string' && genderFromAttr) out.gender = genderFromAttr

  // Height — check personal first, then UserProfile, then health (backward compat)
  const hProfile = profile.height
  if (typeof hProfile === 'number') out.height = hProfile
  const hAttr = personal.height?.value ?? health.height?.value
  if (typeof hAttr === 'number') out.height = hAttr

  // Weight — check personal first, then UserProfile, then health (backward compat)
  const wProfile = profile.weight
  if (typeof wProfile === 'number') out.weight = wProfile
  const wAttr = personal.weight?.value ?? health.weight?.value
  if (typeof wAttr === 'number') out.weight = wAttr

  return out
}

export function inferAttributeToolCallsFromMessage(
  message: string,
  ctx: InferenceContext,
): ToolCall[] {
  const calls: ToolCall[] = []
  const lower = message.toLowerCase()
  const now = new Date().toISOString()

  const effectiveDomain =
    ctx.activeSpecialist?.domains?.includes(ctx.domainHint) ||
    ctx.activeSpecialist?.domain === ctx.domainHint
      ? ctx.domainHint
      : (ctx.activeSpecialist?.domain ?? ctx.domainHint)

  const hasBirthSignal =
    lower.includes('sono nato') ||
    lower.includes('sono nata') ||
    lower.includes('data di nascita') ||
    lower.includes('nato il') ||
    lower.includes('nata il')

  if (hasBirthSignal) {
    const dobIso = parseDobFromNaturalMessage(message)
    if (dobIso) {
      calls.push({
        id: crypto.randomUUID(),
        name: 'user.setAttribute',
        args: {
          domain: 'personal',
          key: 'birthDate',
          value: dobIso,
          notes: 'Estratto automaticamente da messaggio naturale utente',
          recordedAt: now,
        },
      })
    }
  }

  // Age — "ho 35 anni", "ne ho 35", "35 anni" (standalone phrase)
  // Excludes duration phrases like "da 20 anni soffro di X", "20 anni fa", "per 3 anni"
  const ageIsDurationContext = /\b(?:fa|or\s+sono|prima|dopo|da\s+\d|per\s+\d)\b/.test(lower)
  let ageExtracted = false
  if (!ageIsDurationContext) {
    const agePatterns = [
      /\bho\s+(\d{1,3})\s+anni\b/i,
      /\bne\s+ho\s+(\d{1,3})\b/i,
      /\bcompi(?:o|rò)?\s+(\d{1,3})\s+anni\b/i,
      // Standalone "34 anni" without "ho" — catches comma-separated data like "89 kg, 168 cm, 34 anni, maschio"
      /\b(\d{1,3})\s+anni\b/i,
    ]
    for (const re of agePatterns) {
      const m = lower.match(re)
      if (m?.[1]) {
        const age = Number(m[1])
        if (age >= 10 && age <= 110) {
          calls.push({
            id: crypto.randomUUID(),
            name: 'user.setAttribute',
            args: { domain: 'personal', key: 'age', value: age, unit: 'years', recordedAt: now },
          })
          ageExtracted = true
          break
        }
      }
    }
  }
  // Bare number response (e.g. "35") — only if no other age was extracted and message is very short
  // This catches direct answers to "Quanti anni hai?"
  if (!ageExtracted && !hasBirthSignal) {
    const bareAge = lower.trim().match(/^(\d{1,3})$/)
    if (bareAge?.[1]) {
      const age = Number(bareAge[1])
      if (age >= 10 && age <= 110) {
        calls.push({
          id: crypto.randomUUID(),
          name: 'user.setAttribute',
          args: { domain: 'personal', key: 'age', value: age, unit: 'years', recordedAt: now },
        })
      }
    }
  }

  // Helper: create a setAttribute tool call with timestamp
  const attr = (domain: string, key: string, value: unknown, unit?: string) => {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: { domain, key, value, ...(unit ? { unit } : {}), recordedAt: now },
    })
  }

  // ── Allergies & Intolerances ──────────────────────────────────────────────
  const allergyPatterns = [
    /allergic[oa]\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù''\s]+)/i,
    /allergia\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù''\s]+)/i,
    /intollerante\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù''\s]+)/i,
    /intolleranza\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù''\s]+)/i,
    /non\s+posso\s+mangiare\s+(?:il|la|i|le|gli|l')?\s*([a-zàèéìòù''\s]+)/i,
  ]
  for (const re of allergyPatterns) {
    const m = lower.match(re)
    const rawAllergen = m?.[1]
    if (!rawAllergen) continue
    const allergen = rawAllergen
      .trim()
      .replace(/[.,;!?]+$/g, '')
      .replace(/^(al|allo|alla|ai|agli|alle)\s+/i, '')
    if (allergen.length >= 2) {
      attr('nutrition', 'allergy', allergen)
      break
    }
  }

  // ── Training frequency ────────────────────────────────────────────────────
  const freqMatch = lower.match(
    /(?:mi\s+)?alleno\s+(\d{1,2})\s+volt[ea]\s+(?:a|alla|per)\s+settimana/i,
  )
  if (freqMatch?.[1]) {
    attr('training', 'training_frequency_per_week', Number(freqMatch[1]), 'sessions/week')
  }
  // Broader frequency: "3 volte a settimana" / "3 volte alla settimana" without "alleno"
  if (!freqMatch) {
    const broadFreq = lower.match(/\b(\d{1,2})\s+volt[ea]\s+(?:a|alla|per)\s+settimana\b/i)
    if (broadFreq?.[1]) {
      const freq = Number(broadFreq[1])
      if (freq >= 1 && freq <= 14) {
        attr('training', 'training_frequency_per_week', freq, 'sessions/week')
      }
    }
  }

  // ── Medical conditions (broad pattern) ────────────────────────────────────
  const conditionPatterns = [
    /\b(?:soffro\s+di|ho\s+(?:la|il|l'|le|i|gli)?)\s*(gastrite|reflusso|diabete|asma|ipertensione|ipotensione|anemia|artrite|artrosi|fibromialgia|celiachia|colite|emicrania|epilessia|osteoporosi|tiroidite|ipotiroidismo|ipertiroidismo|endometriosi|psoriasi|eczema|dermatite|ernia|scoliosi|lordosi|cifosi)\b/i,
    /\b(?:mi\s+(?:è\s+stata?\s+)?diagnosticat[oa])\s+(?:la|il|l'|un|una|uno)?\s*([a-zàèéìòù\s]{3,40})/i,
  ]
  for (const re of conditionPatterns) {
    const m = lower.match(re)
    if (m?.[1]) {
      const condition = m[1].trim().replace(/[.,;!?]+$/g, '')
      if (condition.length >= 3) {
        attr('health', 'diagnosis', condition)
        break
      }
    }
  }

  // ── Hypertension (specific) ───────────────────────────────────────────────
  if (lower.includes('ipertensione')) {
    attr('health', 'hypertension', true)
    const yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/)
    if (yearMatch?.[1]) {
      attr('health', 'hypertension_diagnosed_year', Number(yearMatch[1]))
    }
  }

  // ── Medications ───────────────────────────────────────────────────────────
  const medPatterns = [
    /\b(?:prendo|assumo|sto\s+prendendo|mi\s+hanno\s+prescritto)\s+(?:il|la|l'|le|i|gli|un|una|lo)?\s*([a-zàèéìòù\s]{3,50})/i,
  ]
  for (const re of medPatterns) {
    const m = lower.match(re)
    if (m?.[1]) {
      const med = m[1]
        .trim()
        .replace(/[.,;!?]+$/g, '')
        .replace(/\s+(da|per|ogni|al)\s+.*$/, '')
      if (med.length >= 3 && !/\b(mattina|sera|giorno|colazione|pranzo|cena)\b/.test(med)) {
        attr('health', 'medications', med)
        break
      }
    }
  }

  // ── Symptoms (broad) ──────────────────────────────────────────────────────
  const symptomPatterns = [
    /\b(?:ho|avverto|sento)\s+(?:spesso\s+)?(?:un|una|dei|delle)?\s*(nausea|vertigini|tachicardia|palpitazioni|bruciore|gonfiore|prurito|formicolio|stanchezza|affaticamento|capogiri|crampi|tremori|sudorazione)\b/i,
  ]
  for (const re of symptomPatterns) {
    const m = lower.match(re)
    if (m?.[1]) {
      attr('health', 'symptoms', m[1].trim())
      break
    }
  }

  // ── Food triggers ─────────────────────────────────────────────────────────
  const foodTriggerPatterns = [
    /\b(?:mi\s+(?:peggiora|fa\s+male|dà\s+fastidio|provoca)\s+(?:il|la|l'|i|le|lo)?\s*)([a-zàèéìòù\s]{3,40})/i,
    /\b([a-zàèéìòù\s]{3,30})\s+(?:mi\s+(?:peggiora|fa\s+male|dà\s+fastidio|provoca))\b/i,
  ]
  for (const re of foodTriggerPatterns) {
    const m = lower.match(re)
    if (m?.[1]) {
      const trigger = m[1].trim().replace(/[.,;!?]+$/g, '')
      if (trigger.length >= 3 && !/\b(tutto|niente|nulla|sempre|mai)\b/.test(trigger)) {
        attr('nutrition', 'food_triggers', trigger)
        break
      }
    }
  }

  // ── Goals / Objectives (expanded) ─────────────────────────────────────────
  const isQuestionLike =
    lower.includes('?') || lower.startsWith('qual ') || lower.startsWith('quale ')
  if (!isQuestionLike) {
    const goalPatterns = [
      /\b(?:voglio|vorrei|desidero|mi\s+piacerebbe)\s+(dimagrire|perdere\s+peso|mettere\s+massa|tonificare|ingrassare|aumentare\s+di\s+peso|migliorare\s+la\s+forma)/i,
      /\b(?:il\s+mio\s+)?obiettivo\s*(?:è|e|:)?\s*(.{4,80}?)(?:[.,;!]|$)/i,
      /\b(?:voglio|vorrei)\s+(?:impostare|creare|avere|seguire)\s+(?:un|una|il|la)\s+(?:piano|dieta|programma|scheda)\s+(?:per\s+)?(.{3,60}?)(?:[.,;!]|$)/i,
    ]
    for (const re of goalPatterns) {
      const m = lower.match(re) ?? message.match(re)
      if (m?.[1]) {
        const goalText = m[1]
          .trim()
          .replace(/[.,;!?]+$/g, '')
          .slice(0, 240)
        if (goalText.length >= 3) {
          attr(effectiveDomain === 'nutrition' ? 'nutrition' : 'general', 'goal', goalText)
          break
        }
      }
    }
  }
  // Fallback for inspiration domain goals
  if (
    !isQuestionLike &&
    !calls.some((c) => (c.args as Record<string, unknown>)['key'] === 'goal') &&
    (effectiveDomain === 'inspiration' || lower.includes('podcast') || lower.includes('progetto'))
  ) {
    const goalText =
      message.match(/obiettivo\s*(?:è|e)?\s*(.+)$/i)?.[1]?.trim() ??
      message.match(/(?:lanciare|avviare)\s+(.+)$/i)?.[0]?.trim()
    if (goalText && goalText.length >= 4) {
      attr('general', 'goal', goalText.slice(0, 240))
    }
  }

  // ── Sport / activity ──────────────────────────────────────────────────────
  const sportPatterns = [
    /\b(?:faccio|pratico|gioco\s+a)\s+([a-zàèéìòù\s]{3,30})(?:\s+da|\s+\d|\b)/i,
    // Broader: "vado in palestra", "vado a correre", "vado a nuotare"
    /\bvado\s+(?:in\s+|a\s+)(palestra|piscina|correre|nuotare|camminare|CrossFit|yoga|pilates)\b/i,
    // "faccio pesi", "faccio cardio", "faccio CrossFit"
    /\bfaccio\s+(pesi|cardio|CrossFit|yoga|pilates|boxe|nuoto|corsa|ciclismo)\b/i,
  ]
  for (const re of sportPatterns) {
    const m = lower.match(re)
    if (m?.[1]) {
      const sport = m[1].trim().replace(/[.,;!?]+$/g, '')
      // Exclude very generic words
      if (
        sport.length >= 3 &&
        !/\b(sport|attività|esercizio|niente|nulla|poco|tanto|molto)\b/.test(sport)
      ) {
        attr('training', 'sport', sport)
        break
      }
    }
  }

  // ── Stress & Sleep ────────────────────────────────────────────────────────
  const stressMatch = lower.match(/stress\s+(\d{1,2})\s*(?:su|\/)\s*10/i)
  if (stressMatch?.[1]) {
    attr('mindfulness', 'stress_level', Number(stressMatch[1]), '/10')
  }
  // Broader stress signal
  if (
    !stressMatch &&
    /\b(?:sono\s+(?:molto\s+)?stressat[oa]|ho\s+(?:molto\s+)?stress|sono\s+esaurit[oa]|ho\s+il\s+burnout|burnout)\b/.test(
      lower,
    )
  ) {
    attr('mindfulness', 'stress_level', 'alto')
  }

  const sleepMatch = lower.match(/dormo\s+(?:circa\s+)?(\d{1,2})\s+ore/i)
  if (sleepMatch?.[1]) {
    attr('mindfulness', 'sleep_hours', Number(sleepMatch[1]), 'hours')
  }

  // ── Weight ────────────────────────────────────────────────────────────────
  const weightMatch = lower.match(
    /(?:peso|peso\s+circa|sono\s+(?:sui|intorno\s+ai|a\s+circa))\s*(\d{2,3})(?:[.,]\d)?\s*(?:kg|chili|chilo|kili|k(?:g)?)?(?:\b|$)/i,
  )
  if (weightMatch?.[1]) {
    const w = Number(weightMatch[1])
    if (w >= 30 && w <= 300) {
      attr('personal', 'weight', w, 'kg')
    }
  }
  if (!weightMatch) {
    const bareWeightKg = lower.match(/\b(\d{2,3})(?:[.,]\d)?\s*(?:kg|chili|chilo|kili)\b/i)
    if (bareWeightKg?.[1]) {
      const w = Number(bareWeightKg[1])
      if (w >= 30 && w <= 300) {
        attr('personal', 'weight', w, 'kg')
      }
    }
  }

  // ── Height ────────────────────────────────────────────────────────────────
  const heightCmMatch = lower.match(/(?:sono\s+alto|altezza|alt\.|alto)\s+(\d{2,3})\s*cm/i)
  if (heightCmMatch?.[1]) {
    const h = Number(heightCmMatch[1])
    if (h >= 100 && h <= 250) attr('personal', 'height', h, 'cm')
  }
  const heightMtMatch = lower.match(/(?:sono\s+alto|altezza|alto)\s+1[,.](\d{1,2})\s*m?/i)
  if (!heightCmMatch && heightMtMatch?.[1]) {
    const decimals = heightMtMatch[1].padEnd(2, '0').slice(0, 2)
    const h = Math.round(100 + Number(decimals))
    if (h >= 100 && h <= 250) attr('personal', 'height', h, 'cm')
  }
  const heightBareMatch = lower.match(/sono\s+(?:alto|alta)\s+(\d{3})\b/i)
  if (!heightCmMatch && !heightMtMatch && heightBareMatch?.[1]) {
    const h = Number(heightBareMatch[1])
    if (h >= 100 && h <= 250) attr('personal', 'height', h, 'cm')
  }
  const heightAlreadyCaptured = !!(heightCmMatch ?? heightMtMatch ?? heightBareMatch)
  if (!heightAlreadyCaptured && !lower.includes('/')) {
    const bareHeightCm = lower.match(/\b(1[0-9]{2}|2[0-4]\d)\s*cm\b/i)
    if (bareHeightCm?.[1]) {
      const h = Number(bareHeightCm[1])
      if (h >= 100 && h <= 250) attr('personal', 'height', h, 'cm')
    }
  }

  // ── Blood pressure ────────────────────────────────────────────────────────
  const bpMatch = lower.match(/(?:pressione\s+)?(\d{2,3})\s*[\/]\s*(\d{2,3})\s*(?:mmhg)?/i)
  if (bpMatch?.[1] && bpMatch?.[2]) {
    const sys = Number(bpMatch[1])
    const dia = Number(bpMatch[2])
    if (sys >= 60 && sys <= 250 && dia >= 40 && dia <= 150) {
      attr('health', 'blood_pressure', `${sys}/${dia}`, 'mmHg')
    }
  }

  // ── Heart rate ────────────────────────────────────────────────────────────
  const hrMatch = lower.match(/(?:frequenza\s+cardiaca|fc|battiti|bpm[:\s]+)?(\d{2,3})\s*bpm/i)
  if (hrMatch?.[1]) {
    const hr = Number(hrMatch[1])
    if (hr >= 30 && hr <= 220) attr('health', 'restingHr', hr, 'bpm')
  }

  // ── Smoking ───────────────────────────────────────────────────────────────
  if (
    /\b(?:non\s+fumo|non\s+sono\s+fumatore|ex[\s-]?fumator[ei]|ho\s+smesso\s+di\s+fumare)\b/.test(
      lower,
    )
  ) {
    attr('personal', 'smokingStatus', 'non-smoker')
  } else if (/\b(?:fumo|sono\s+fumator[ei]|sigarette)\b/.test(lower)) {
    attr('personal', 'smokingStatus', 'smoker')
  }

  // ── Name ──────────────────────────────────────────────────────────────────
  const namePatterns = [
    /\bmi\s+chiamo\s+([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{1,30}(?:\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{1,30})?)/,
    /\bil\s+mio\s+nome\s+[eè]\s+([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{1,30}(?:\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{1,30})?)/i,
    /\bmi\s+presento[,:]?\s+sono\s+([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{1,30}(?:\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{1,30})?)/,
  ]
  let nameFound = false
  for (const re of namePatterns) {
    const m = message.match(re)
    if (m?.[1] && m[1].length >= 2) {
      attr('personal', 'name', m[1].trim())
      nameFound = true
      break
    }
  }
  if (!nameFound) {
    const bareFullName = message
      .trim()
      .match(/^([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,30})\s+([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,30})$/)
    if (bareFullName) {
      attr('personal', 'name', `${bareFullName[1]} ${bareFullName[2]}`)
    }
  }

  // ── Gender ────────────────────────────────────────────────────────────────
  if (!calls.some((c) => (c.args as Record<string, unknown>)['key'] === 'gender')) {
    const isMale =
      /\b(?:sono\s+(?:un\s+)?uomo|sono\s+maschio|sesso\s+maschile|genere\s+maschile)\b/.test(
        lower,
      ) ||
      /^m(?:aschio)?\.?$/i.test(lower.trim()) ||
      // Standalone "maschio" or "uomo" anywhere in text (e.g. "89 kg, 168 cm, 34 anni, maschio")
      /\bmaschio\b/i.test(lower) ||
      /\buomo\b/i.test(lower)
    const isFemale =
      /\b(?:sono\s+(?:una\s+)?donna|sono\s+femmina|sesso\s+femminile|genere\s+femminile)\b/.test(
        lower,
      ) ||
      /^f(?:emmina)?\.?$/i.test(lower.trim()) ||
      // Standalone "femmina" or "donna" anywhere in text
      /\bfemmina\b/i.test(lower) ||
      /\bdonna\b/i.test(lower)
    if (isMale) attr('personal', 'gender', 'male')
    else if (isFemale) attr('personal', 'gender', 'female')
  }

  // ── Diet type ─────────────────────────────────────────────────────────────
  if (/\b(?:sono\s+vegano|sono\s+vegana|dieta\s+vegana)\b/.test(lower)) {
    attr('nutrition', 'dietType', 'vegan')
  } else if (/\b(?:sono\s+vegetariano|sono\s+vegetariana|dieta\s+vegetariana)\b/.test(lower)) {
    attr('nutrition', 'dietType', 'vegetarian')
  }
  if (/\b(?:celiaco|celiaca|intollerante\s+al\s+glutine|senza\s+glutine)\b/.test(lower)) {
    attr('nutrition', 'intolerances', 'gluten')
  }
  if (/\b(?:intollerante\s+al\s+lattosio|senza\s+lattosio)\b/.test(lower)) {
    attr('nutrition', 'intolerances', 'lactose')
  }

  // ── Water intake ──────────────────────────────────────────────────────────
  const waterMatch = lower.match(/bevo\s+(?:circa\s+)?(\d+)[,.]?(\d*)\s*litri/i)
  if (waterMatch?.[1]) {
    const liters = Number(`${waterMatch[1]}.${(waterMatch[2] ?? '0').padEnd(1, '0')}`)
    if (liters >= 0.5 && liters <= 10) {
      attr('nutrition', 'waterGoal', Math.round(liters * 1000), 'ml')
    }
  }

  // ── Meals per day ─────────────────────────────────────────────────────────
  const mealsMatch = lower.match(/(?:faccio|mangio)\s+(\d)\s+(?:pasti|volte\s+al\s+giorno)/i)
  if (mealsMatch?.[1]) {
    const meals = Number(mealsMatch[1])
    if (meals >= 1 && meals <= 8) attr('nutrition', 'mealsPerDay', meals)
  }

  // ── Injury/pain ───────────────────────────────────────────────────────────
  const painMatch = lower.match(
    /(?:dolore\s+(?:al|alla|alle|agli|ai)\s+(\w+)|mi\s+fa\s+male\s+(?:il|la|le|i|gli|l')\s+(\w+))/i,
  )
  if (painMatch?.[1] ?? painMatch?.[2]) {
    const location = (painMatch?.[1] ?? painMatch?.[2] ?? '').trim()
    if (location.length >= 3) attr('training', 'injury', location)
  }

  // ── Dedup & return ────────────────────────────────────────────────────────
  const seen = new Set<string>()
  return calls.filter((c) => {
    const k = `${c.name}:${JSON.stringify(c.args)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
