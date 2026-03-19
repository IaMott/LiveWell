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

  it('classifies implicit nutrition requests without naming the specialist', () => {
    expect(detectDomainFromText('voglio una dieta')).toBe('nutrition')
    expect(detectDomainFromText('piano alimentare per dimagrire')).toBe('nutrition')
    expect(detectDomainFromText('ho gastrite e non so cosa mangiare')).toBe('nutrition')
  })

  it('classifies implicit training and mindfulness requests from natural language', () => {
    expect(detectDomainFromText('mi serve una scheda per ricominciare')).toBe('training')
    expect(detectDomainFromText('sono stressato e dormo male')).toBe('mindfulness')
    expect(detectDomainFromText('ansia alta e non riesco a concentrarmi')).toBe('mindfulness')
  })

  it('classifies inspiration and health implicit cases across distant domains', () => {
    expect(detectDomainFromText('mi sto separando e ci sono problemi legali')).toBe('inspiration')
    expect(detectDomainFromText('ho debiti e sto andando in ansia')).toBe('inspiration')
    expect(detectDomainFromText('ho sfoghi cutanei strani')).toBe('health')
    expect(detectDomainFromText('gonfiore e problemi digestivi continui')).toBe('health')
  })
})
