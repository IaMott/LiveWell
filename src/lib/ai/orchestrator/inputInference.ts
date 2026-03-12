import { ActiveSpecialist, ContextPack, Domain, ToolCall } from '../types'

export type InferenceContext = {
  domainHint: Domain
  activeSpecialist?: ActiveSpecialist
}

export type PersonalSnapshot = {
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

  const out: PersonalSnapshot = {}

  const birthFromProfile = profile.birthDate
  if (typeof birthFromProfile === 'string' && birthFromProfile) out.birthDate = birthFromProfile
  const birthFromAttr = personal.birthDate?.value
  if (typeof birthFromAttr === 'string' && birthFromAttr) out.birthDate = birthFromAttr

  const genderFromProfile = profile.gender
  if (typeof genderFromProfile === 'string' && genderFromProfile) out.gender = genderFromProfile
  const genderFromAttr = personal.gender?.value
  if (typeof genderFromAttr === 'string' && genderFromAttr) out.gender = genderFromAttr

  const hProfile = profile.height
  if (typeof hProfile === 'number') out.height = hProfile
  const hAttr = personal.height?.value
  if (typeof hAttr === 'number') out.height = hAttr

  const wProfile = profile.weight
  if (typeof wProfile === 'number') out.weight = wProfile
  const wAttr = personal.weight?.value
  if (typeof wAttr === 'number') out.weight = wAttr

  return out
}

export function inferAttributeToolCallsFromMessage(
  message: string,
  ctx: InferenceContext,
): ToolCall[] {
  const calls: ToolCall[] = []
  const lower = message.toLowerCase()

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
        },
      })
    }
  }

  const allergyPatterns = [
    /allergic[oa]\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù'’\s]+)/i,
    /allergia\s+a(?:l|ll|gli|lle|ll')?\s*([a-zàèéìòù'’\s]+)/i,
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
      calls.push({
        id: crypto.randomUUID(),
        name: 'user.setAttribute',
        args: {
          domain: 'nutrition',
          key: 'allergy',
          value: allergen,
        },
      })
      break
    }
  }

  const freqMatch = lower.match(/alleno\s+(\d{1,2})\s+volt[ea]\s+a\s+settimana/i)
  if (freqMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'training',
        key: 'training_frequency_per_week',
        value: Number(freqMatch[1]),
        unit: 'sessions/week',
      },
    })
  }

  if (lower.includes('ipertensione')) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'health',
        key: 'hypertension',
        value: true,
      },
    })
  }
  const yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/)
  if (lower.includes('ipertensione') && yearMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'health',
        key: 'hypertension_diagnosed_year',
        value: Number(yearMatch[1]),
      },
    })
  }

  const stressMatch = lower.match(/stress\s+(\d{1,2})\s*(?:su|\/)\s*10/i)
  if (stressMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'mindfulness',
        key: 'stress_level',
        value: Number(stressMatch[1]),
        unit: '/10',
      },
    })
  }
  const sleepMatch = lower.match(/dormo\s+(\d{1,2})\s+ore/i)
  if (sleepMatch?.[1]) {
    calls.push({
      id: crypto.randomUUID(),
      name: 'user.setAttribute',
      args: {
        domain: 'mindfulness',
        key: 'sleep_hours',
        value: Number(sleepMatch[1]),
        unit: 'hours',
      },
    })
  }

  const isQuestionLike =
    lower.includes('?') || lower.startsWith('qual ') || lower.startsWith('quale ')
  if (
    !isQuestionLike &&
    (effectiveDomain === 'inspiration' ||
      lower.includes('obiettivo') ||
      lower.includes('podcast') ||
      lower.includes('progetto'))
  ) {
    const goalText =
      message.match(/obiettivo\s*(?:è|e)?\s*(.+)$/i)?.[1]?.trim() ??
      message.match(/(?:lanciare|avviare)\s+(.+)$/i)?.[0]?.trim()
    if (goalText && goalText.length >= 4) {
      calls.push({
        id: crypto.randomUUID(),
        name: 'user.setAttribute',
        args: {
          domain: 'general',
          key: 'goal',
          value: goalText.slice(0, 240),
        },
      })
    }
  }

  const seen = new Set<string>()
  return calls.filter((c) => {
    const k = `${c.name}:${JSON.stringify(c.args)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
