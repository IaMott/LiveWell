import { Domain } from '../types'

const KEYWORDS: Record<Domain, string[]> = {
  nutrition: [
    'cibo',
    'dieta',
    'macro',
    'kcal',
    'calorie',
    'ricetta',
    'ricette',
    'spesa',
    'lista spesa',
    'barcode',
    'meal',
    'pasto',
    'colazione',
    'pranzo',
    'cena',
    'spuntino',
  ],
  training: [
    'allenamento',
    'palestra',
    'workout',
    'scheda',
    'esercizio',
    'serie',
    'ripetizioni',
    'reps',
    'sets',
    'carico',
    'peso sollevato',
    'recupero',
    'timer',
  ],
  health: [
    'peso',
    'pressione',
    'dolore',
    'infortunio',
    'sintomo',
    'medico',
    'farmaco',
    'allergia',
    'condizione',
    'salute',
    'misure',
    'bf',
    'body fat',
  ],
  mindfulness: [
    'ansia',
    'stress',
    'umore',
    'sonno',
    'mindfulness',
    'meditazione',
    'confessione',
    'pensieri',
    'psicologo',
    'terapia',
    'emozioni',
  ],
  inspiration: [
    'idea',
    'ispirazione',
    'brainstorm',
    'progetto',
    'creatività',
    'scrivere',
    'design',
    'business',
    'lavoro',
    'career',
    'obiettivo professionale',
  ],
  general: [],
}

export function detectDomainFromText(text: string): Domain {
  const t = text.toLowerCase()
  let best: { d: Domain; score: number } = { d: 'general', score: 0 }

  ;(Object.keys(KEYWORDS) as Domain[]).forEach((d) => {
    if (d === 'general') return
    const score = KEYWORDS[d].reduce((acc, kw) => (t.includes(kw) ? acc + 1 : acc), 0)
    if (score > best.score) best = { d, score }
  })

  return best.score > 0 ? best.d : 'general'
}

export function detectDomainsMulti(text: string): Array<{ domain: Domain; score: number }> {
  const t = text.toLowerCase()
  return (Object.keys(KEYWORDS) as Domain[])
    .filter((d) => d !== 'general')
    .map((d) => ({
      domain: d,
      score: KEYWORDS[d].reduce((acc, kw) => (t.includes(kw) ? acc + 1 : acc), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
}
