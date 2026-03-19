import { describe, expect, it } from 'vitest'
import { detectDomainFromText, detectDomainsMulti } from '@/lib/ai/domain/domainDetection'

describe('critical domain detection', () => {
  it('classifies dolore toracico e fiato corto as health', () => {
    expect(detectDomainFromText('ho dolore toracico e fiato corto')).toBe('health')
  })

  it('classifies dispnea during training as health instead of training', () => {
    expect(detectDomainFromText('ho dispnea durante allenamento e workout')).toBe('health')
  })

  it('ranks health first for critical chest symptoms in multi-domain detection', () => {
    const out = detectDomainsMulti('dolore toracico durante allenamento con fiato corto')
    expect(out[0]).toMatchObject({ domain: 'health' })
  })
})
