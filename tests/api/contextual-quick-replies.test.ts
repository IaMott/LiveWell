import { describe, expect, it } from 'vitest'
import { buildContextualQuickReplies } from '@/lib/ai/orchestrator/contextualQuickReplies'

describe('contextual quick replies', () => {
  it('genera quick replies contestuali per una domanda semplice e univoca', () => {
    const replies = buildContextualQuickReplies('Per aiutarmi meglio, dove senti il dolore?')

    expect(replies.length).toBeGreaterThanOrEqual(2)
    expect(replies.map((reply) => reply.label)).toContain('Collo')
    expect(new Set(replies.map((reply) => reply.label)).size).toBe(replies.length)
  })

  it('non mostra quick replies quando la domanda è composta e rischia chip fuorvianti', () => {
    const replies = buildContextualQuickReplies(
      'Per aiutarmi meglio, quante volte ti alleni e in quali orari?',
    )

    expect(replies).toEqual([])
  })

  it('usa davvero l’ultima domanda utile del messaggio assistant invece di una domanda più vecchia', () => {
    const replies = buildContextualQuickReplies(
      'Prima localizziamo il problema: dove senti il dolore? Ora dimmi quante volte succede in una settimana?',
    )

    expect(replies.map((reply) => reply.text)).toContain('1-2 volte a settimana')
    expect(replies.map((reply) => reply.label)).not.toContain('Collo')
  })
})
